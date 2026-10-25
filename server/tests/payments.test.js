import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { esewaSignature } from '../src/services/payments/esewa.js'
import { expireSubscriptions, sendRenewalReminders } from '../src/services/subscriptionJobs.js'
import { createSession } from '../src/services/token.js'
import { resetDb, createListing } from './helpers/db.js'
import { createUser, flushRedis } from './helpers/auth.js'

const app = createApp()
const DAY = 24 * 60 * 60 * 1000
const PRICE = 4000

let owner
let token
let listing
let plan

const post = (path, body, t = token) =>
  request(app).post(`/api/v1/payments${path}`).set('Authorization', `Bearer ${t}`).send(body)

/** fetch stub answering Khalti and eSewa calls from a table of handlers. */
function gateway(handlers) {
  const fn = vi.fn(async (url, init) => {
    const href = String(url)
    for (const [match, handler] of handlers) {
      if (href.includes(match)) {
        const { status = 200, body } = await handler(href, init)
        return { ok: status < 300, status, json: async () => body }
      }
    }
    throw new Error(`unexpected fetch ${href}`)
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

const khaltiOk = (overrides = {}) =>
  gateway([
    [
      '/epayment/initiate/',
      () => ({
        body: {
          pidx: 'PIDX1',
          payment_url: 'https://test-pay.khalti.com/?pidx=PIDX1',
          expires_in: 1800,
        },
      }),
    ],
    [
      '/epayment/lookup/',
      () => ({
        body: {
          pidx: 'PIDX1',
          status: 'Completed',
          total_amount: PRICE * 100,
          transaction_id: 'T1',
          ...overrides,
        },
      }),
    ],
  ])

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  owner = await createUser({ role: 'BUSINESS_OWNER' })
  token = (await createSession(owner, { mfa: false })).accessToken
  listing = await createListing({ ownerId: owner.id })
  plan = await db.plan.create({
    data: {
      code: 'FEATURED',
      name: 'Featured',
      priceNpr: PRICE,
      durationDays: 30,
      features: { maxPhotos: 12, maxVideos: 3, featured: true, homepage: true },
    },
  })
})
afterEach(() => vi.unstubAllGlobals())

describe('eSewa signatures', () => {
  // eSewa's documented example result does not match its own input; this vector was accepted
  // by the UAT form endpoint (302 to the payment page; a wrong signature gets 400).
  it('signs like the eSewa UAT endpoint expects', () => {
    expect(
      esewaSignature(
        { total_amount: '100', transaction_uuid: 'atk-vector-0001', product_code: 'EPAYTEST' },
        'total_amount,transaction_uuid,product_code',
      ),
    ).toBe('R0fFl7N+lfhgnKYmtMU3ycJxCpab6l3v2oOauIUMF0M=')
  })
})

describe('Khalti', () => {
  it('initiates with the price from plans and activates once after lookup (repeat is a no-op)', async () => {
    const fetchMock = khaltiOk()
    const init = await post('/khalti/initiate', {
      businessId: listing.id,
      planCode: 'featured',
      amount: 1,
    })
    expect(init.status).toBe(201)
    expect(init.body.data.paymentUrl).toContain('pidx=PIDX1')
    const [, initCall] = fetchMock.mock.calls[0]
    expect(JSON.parse(initCall.body)).toMatchObject({
      amount: PRICE * 100,
      return_url: 'http://localhost:3000/business/plan/return/khalti',
    })
    expect(initCall.headers.Authorization).toBe('Key test-khalti-key')

    const payment = await db.payment.findUnique({ where: { gatewayRef: 'PIDX1' } })
    expect(payment).toMatchObject({ status: 'INITIATED', amountNpr: PRICE, gateway: 'KHALTI' })

    const verified = await post('/khalti/verify', { pidx: 'PIDX1' })
    expect(verified.body.data).toMatchObject({
      status: 'COMPLETED',
      amountNpr: PRICE,
      plan: 'Featured',
    })
    expect(verified.body.data.invoiceNo).toMatch(/^ATK-\d{8}-[0-9A-F]{8}$/)

    const sub = await db.subscription.findUnique({ where: { id: payment.subscriptionId } })
    expect(sub.status).toBe('ACTIVE')
    expect(sub.endsAt.getTime() - sub.startsAt.getTime()).toBe(30 * DAY)
    expect((await db.business.findUnique({ where: { id: listing.id } })).featuredUntil).toEqual(
      sub.endsAt,
    )
    expect((await getQueue(QUEUE.REVALIDATE).getJobs(['waiting'])).length).toBeGreaterThan(0)

    const again = await post('/khalti/verify', { pidx: 'PIDX1' })
    expect(again.body.data).toEqual(verified.body.data)
    expect(await db.auditLog.count({ where: { action: 'subscription.activate' } })).toBe(1)
    expect((await db.subscription.findUnique({ where: { id: sub.id } })).endsAt).toEqual(sub.endsAt)
  })

  it('refuses a payment whose amount does not match the plan', async () => {
    khaltiOk({ total_amount: 100 })
    await post('/khalti/initiate', { businessId: listing.id, planCode: 'FEATURED' })
    const res = await post('/khalti/verify', { pidx: 'PIDX1' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('PAYMENT_MISMATCH')
    expect((await db.payment.findUnique({ where: { gatewayRef: 'PIDX1' } })).status).toBe('FAILED')
    expect((await db.business.findUnique({ where: { id: listing.id } })).featuredUntil).toBeNull()
  })

  it('keeps pending payments pending and fails expired ones', async () => {
    khaltiOk({ status: 'Pending' })
    await post('/khalti/initiate', { businessId: listing.id, planCode: 'FEATURED' })
    expect((await post('/khalti/verify', { pidx: 'PIDX1' })).body.data.status).toBe('PENDING')

    khaltiOk({ status: 'Expired' })
    expect((await post('/khalti/verify', { pidx: 'PIDX1' })).body.data.status).toBe('FAILED')
    const payment = await db.payment.findUnique({
      where: { gatewayRef: 'PIDX1' },
      include: { subscription: true },
    })
    expect([payment.status, payment.subscription.status]).toEqual(['FAILED', 'CANCELLED'])
  })

  it('only lets owners buy for their own listing, and only plans on sale', async () => {
    khaltiOk()
    const other = await createListing()
    expect(
      (await post('/khalti/initiate', { businessId: other.id, planCode: 'FEATURED' })).status,
    ).toBe(404)
    await db.plan.update({ where: { id: plan.id }, data: { isActive: false } })
    expect(
      (await post('/khalti/initiate', { businessId: listing.id, planCode: 'FEATURED' })).status,
    ).toBe(400)
    await db.plan.update({ where: { id: plan.id }, data: { isActive: true } })

    await post('/khalti/initiate', { businessId: listing.id, planCode: 'FEATURED' })
    const stranger = await createUser({ role: 'BUSINESS_OWNER' })
    const { accessToken } = await createSession(stranger, { mfa: false })
    expect((await post('/khalti/verify', { pidx: 'PIDX1' }, accessToken)).status).toBe(404)
  })

  it('stacks a renewal after the current period', async () => {
    khaltiOk()
    await post('/khalti/initiate', { businessId: listing.id, planCode: 'FEATURED' })
    await post('/khalti/verify', { pidx: 'PIDX1' })
    const first = await db.subscription.findFirst({ where: { status: 'ACTIVE' } })

    gateway([
      [
        '/epayment/initiate/',
        () => ({ body: { pidx: 'PIDX2', payment_url: 'https://test-pay.khalti.com/?pidx=PIDX2' } }),
      ],
      [
        '/epayment/lookup/',
        () => ({ body: { pidx: 'PIDX2', status: 'Completed', total_amount: PRICE * 100 } }),
      ],
    ])
    await post('/khalti/initiate', { businessId: listing.id, planCode: 'FEATURED' })
    await post('/khalti/verify', { pidx: 'PIDX2' })
    const second = await db.subscription.findFirst({
      where: { status: 'ACTIVE', id: { not: first.id } },
    })
    expect(second.startsAt).toEqual(first.endsAt)
    expect((await db.business.findUnique({ where: { id: listing.id } })).featuredUntil).toEqual(
      second.endsAt,
    )
  })
})

describe('eSewa', () => {
  const signedData = (fields) => {
    const signed_field_names =
      'transaction_code,status,total_amount,transaction_uuid,product_code,signed_field_names'
    const body = { ...fields, signed_field_names }
    body.signature = esewaSignature(body, signed_field_names)
    return Buffer.from(JSON.stringify(body)).toString('base64')
  }

  it('signs the form, checks the redirect signature and the status API, then activates once', async () => {
    const init = await post('/esewa/initiate', { businessId: listing.id, planCode: 'FEATURED' })
    expect(init.status).toBe(201)
    const { formUrl, fields } = init.body.data
    expect(formUrl).toBe('https://rc-epay.esewa.com.np/api/epay/main/v2/form')
    expect(fields).toMatchObject({
      total_amount: String(PRICE),
      product_code: 'EPAYTEST',
      signed_field_names: 'total_amount,transaction_uuid,product_code',
    })
    expect(fields.signature).toBe(esewaSignature(fields, fields.signed_field_names))
    expect(fields.success_url).toBe('http://localhost:3000/business/plan/return/esewa/success')

    const statusCall = gateway([
      [
        '/api/epay/transaction/status/',
        () => ({
          body: {
            product_code: 'EPAYTEST',
            transaction_uuid: fields.transaction_uuid,
            total_amount: PRICE,
            status: 'COMPLETE',
            ref_id: '0001TS9',
          },
        }),
      ],
    ])
    const data = signedData({
      transaction_code: '0LD5CEH',
      status: 'COMPLETE',
      total_amount: '4,000.0',
      transaction_uuid: fields.transaction_uuid,
      product_code: 'EPAYTEST',
    })
    const verified = await post('/esewa/verify', { data })
    expect(verified.body.data.status).toBe('COMPLETED')
    const [statusUrl] = statusCall.mock.calls[0]
    expect(new URL(statusUrl).searchParams.get('total_amount')).toBe(String(PRICE))

    const again = await post('/esewa/verify', { data })
    expect(again.body.data.invoiceNo).toBe(verified.body.data.invoiceNo)
    expect(statusCall).toHaveBeenCalledTimes(1)
  })

  it('rejects tampered redirects and fails payments eSewa does not know', async () => {
    const { fields } = (
      await post('/esewa/initiate', { businessId: listing.id, planCode: 'FEATURED' })
    ).body.data
    const good = JSON.parse(
      Buffer.from(
        signedData({
          transaction_code: 'X',
          status: 'COMPLETE',
          total_amount: '4,000.0',
          transaction_uuid: fields.transaction_uuid,
          product_code: 'EPAYTEST',
        }),
        'base64',
      ).toString(),
    )
    const tampered = Buffer.from(JSON.stringify({ ...good, total_amount: '1.0' })).toString(
      'base64',
    )
    expect((await post('/esewa/verify', { data: tampered })).body.error.code).toBe(
      'SIGNATURE_INVALID',
    )

    gateway([
      ['/api/epay/transaction/status/', () => ({ body: { status: 'NOT_FOUND', ref_id: null } })],
    ])
    const res = await post('/esewa/verify', {
      data: Buffer.from(JSON.stringify(good)).toString('base64'),
    })
    expect(res.body.data.status).toBe('FAILED')
  })
})

describe('subscription jobs', () => {
  async function activeSub({ endsIn, features = plan.features }) {
    const p = await db.plan.create({
      data: {
        code: `P${Math.random().toString(36).slice(2, 8)}`.toUpperCase(),
        name: 'Featured',
        priceNpr: PRICE,
        durationDays: 30,
        features,
      },
    })
    const endsAt = new Date(Date.now() + endsIn)
    await db.business.update({ where: { id: listing.id }, data: { featuredUntil: endsAt } })
    return db.subscription.create({
      data: {
        businessId: listing.id,
        planId: p.id,
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - DAY),
        endsAt,
      },
    })
  }

  it('expires ended plans, clears featuredUntil and fails abandoned checkouts', async () => {
    const sub = await activeSub({ endsIn: -1000 })
    const { payment } = await (async () => {
      const s = await db.subscription.create({
        data: { businessId: listing.id, planId: plan.id, status: 'PENDING' },
      })
      return {
        payment: await db.payment.create({
          data: {
            subscriptionId: s.id,
            businessId: listing.id,
            gateway: 'ESEWA',
            gatewayRef: 'old',
            amountNpr: PRICE,
            createdAt: new Date(Date.now() - 2 * DAY),
          },
        }),
      }
    })()

    expect(await expireSubscriptions()).toEqual({ expired: 1, downgraded: 1, abandoned: 1 })
    expect((await db.subscription.findUnique({ where: { id: sub.id } })).status).toBe('EXPIRED')
    expect((await db.business.findUnique({ where: { id: listing.id } })).featuredUntil).toBeNull()
    expect((await db.payment.findUnique({ where: { id: payment.id } })).status).toBe('FAILED')
    expect(await expireSubscriptions()).toEqual({ expired: 0, downgraded: 0, abandoned: 0 })
  })

  it('sends the 7-day and 1-day reminders once each, and none once renewed', async () => {
    const sub = await activeSub({ endsIn: 6.5 * DAY })
    expect(await sendRenewalReminders()).toEqual({ sent: 1 })
    expect(await sendRenewalReminders()).toEqual({ sent: 0 })
    const [email] = (await getQueue(QUEUE.EMAIL).getJobs(['waiting'])).filter(
      (j) => j.data.template === 'renewal-reminder',
    )
    expect(email.data).toMatchObject({
      to: owner.email,
      data: { daysLeft: 7, planName: 'Featured' },
    })

    await db.subscription.update({
      where: { id: sub.id },
      data: { endsAt: new Date(Date.now() + 0.5 * DAY) },
    })
    expect(await sendRenewalReminders()).toEqual({ sent: 1 })

    await db.subscription.create({
      data: {
        businessId: listing.id,
        planId: sub.planId,
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 40 * DAY),
      },
    })
    await flushRedis()
    expect(await sendRenewalReminders()).toEqual({ sent: 0 })
  })
})
