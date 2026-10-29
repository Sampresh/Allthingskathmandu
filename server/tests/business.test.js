import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { cloudinary } from '../src/config/cloudinary.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { createSession } from '../src/services/token.js'
import { resetDb, createListing } from './helpers/db.js'
import { createUser, flushRedis } from './helpers/auth.js'

const app = createApp()
const DAY = 24 * 60 * 60 * 1000

async function session(role = 'BUSINESS_OWNER', extra = {}) {
  const user = await createUser({ role, ...extra })
  const { accessToken } = await createSession(user, { mfa: false })
  return { user, token: accessToken }
}

const call = (method, path, token, body) => {
  const req = request(app)[method](`/api/v1${path}`).set('Authorization', `Bearer ${token}`)
  return body === undefined ? req : req.send(body)
}

const jobs = async (queue) => getQueue(queue).getJobs(['waiting', 'delayed'])

function mockUpload({ bytes = 200_000, format = 'jpg' } = {}) {
  return vi.spyOn(cloudinary.api, 'resource').mockImplementation(async (publicId) => ({
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/atk-test/image/upload/v1/${publicId}.${format}`,
    bytes,
    format,
    width: 800,
    height: 600,
  }))
}

async function makeFeatured(
  listingId,
  features = { maxPhotos: 1, maxVideos: 1, featured: true, homepage: true },
) {
  const plan = await db.plan.create({
    data: {
      code: `F${Date.now()}${Math.random().toString(36).slice(2, 6)}`.toUpperCase(),
      name: 'Featured',
      priceNpr: 4000,
      durationDays: 30,
      features,
    },
  })
  return db.subscription.create({
    data: {
      businessId: listingId,
      planId: plan.id,
      status: 'ACTIVE',
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 30 * DAY),
    },
  })
}

let owner
let other
let listing
let category

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  owner = await session()
  other = await session()
  const group = await db.category.create({ data: { slug: 'g', nameEn: 'Group' } })
  category = await db.category.create({
    data: { slug: 'cafes', nameEn: 'Cafes', parentId: group.id },
  })
  listing = await createListing({
    ownerId: owner.user.id,
    categories: { create: { categoryId: category.id, isPrimary: true } },
  })
})
afterEach(() => vi.restoreAllMocks())

describe('ownership', () => {
  it("never shows or changes another owner's listing (404 on every :id route)", async () => {
    const id = listing.id
    const attempts = [
      ['get', `/business/listings/${id}`],
      ['patch', `/business/listings/${id}`, { name: 'Hijacked' }],
      ['put', `/business/listings/${id}/hours`, { hours: null }],
      ['put', `/business/listings/${id}/location`, { lat: 27.7, lng: 85.3 }],
      ['post', `/business/listings/${id}/logo/sign`],
      ['post', `/business/listings/${id}/media/sign`],
      [
        'post',
        `/business/listings/${id}/media`,
        { type: 'VIDEO', url: 'https://youtu.be/abcdefgh', altText: 'x' },
      ],
      ['patch', `/business/listings/${id}/media/order`, { ids: [id] }],
      ['delete', `/business/listings/${id}/media/${id}`],
      ['get', `/business/listings/${id}/offers`],
      [
        'post',
        `/business/listings/${id}/offers`,
        { title: 'x', startsAt: new Date(), endsAt: new Date(Date.now() + DAY) },
      ],
      ['patch', `/business/listings/${id}/offers/${id}`, { title: 'x' }],
      ['delete', `/business/listings/${id}/offers/${id}`],
      ['get', `/business/listings/${id}/stats`],
      ['get', `/business/listings/${id}/subscription`],
      ['get', `/business/listings/${id}/invoices`],
    ]
    for (const [method, path, body] of attempts) {
      const res = await call(method, path, other.token, body)
      expect([method, path, res.status]).toEqual([method, path, 404])
    }
    expect((await db.business.findUnique({ where: { id } })).name).not.toBe('Hijacked')
  })

  it('keeps members out and lists only my listings', async () => {
    const member = await session('MEMBER')
    expect((await call('get', '/business/listings', member.token)).status).toBe(403)
    await createListing({ ownerId: other.user.id })
    const mine = await call('get', '/business/listings', owner.token)
    expect(mine.body.data.map((l) => l.id)).toEqual([listing.id])
    expect(mine.body.data[0].last30Days).toEqual({
      views: 0,
      calls: 0,
      whatsapp: 0,
      mapClicks: 0,
      websiteClicks: 0,
    })
  })
})

describe('editing', () => {
  it('updates allowed fields only, audits, and queues refreshes', async () => {
    const res = await call('patch', `/business/listings/${listing.id}`, owner.token, {
      name: 'Bean There',
      phone: '9800000001',
      status: 'LIVE',
      slug: 'stolen-slug',
      isVerified: true,
    })
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      name: 'Bean There',
      phone: '9800000001',
      slug: listing.slug,
      isVerified: false,
    })
    const [log] = await db.auditLog.findMany({ where: { action: 'business.owner_update' } })
    expect(log).toMatchObject({ actorId: owner.user.id, entityId: listing.id })
    expect(log.diff.name.to).toBe('Bean There')
    expect((await jobs(QUEUE.REVALIDATE)).length).toBeGreaterThan(0)
  })

  it('refuses groups as categories', async () => {
    const res = await call('patch', `/business/listings/${listing.id}`, owner.token, {
      categoryIds: [category.parentId],
    })
    expect(res.status).toBe(400)
  })

  it('sets hours and the map location', async () => {
    const area = await db.area.create({
      data: { slug: 'thamel', nameEn: 'Thamel', district: 'Kathmandu' },
    })
    await call('put', `/business/listings/${listing.id}/hours`, owner.token, {
      hours: { mon: [['09:00', '17:00']] },
    })
    const loc = await call('put', `/business/listings/${listing.id}/location`, owner.token, {
      lat: 27.7154,
      lng: 85.3123,
      address: 'Chaksibari Marg',
      areaId: area.id,
    })
    expect(loc.body.data).toMatchObject({
      address: 'Chaksibari Marg',
      areaId: area.id,
      location: { lat: expect.closeTo(27.7154, 4) },
      hours: { mon: [['09:00', '17:00']], sun: [] },
    })
  })

  it('signs logo uploads under this listing and checks the result on Cloudinary', async () => {
    const sign = await call('post', `/business/listings/${listing.id}/logo/sign`, owner.token)
    const params = sign.body.data
    expect(params.public_id.startsWith(`atk-test/listings/${listing.id}/logo-`)).toBe(true)
    expect(params.signature).toBe(
      cloudinary.utils.api_sign_request(
        {
          timestamp: params.timestamp,
          public_id: params.public_id,
          allowed_formats: params.allowed_formats,
        },
        'test-cloudinary-secret',
      ),
    )
    expect(JSON.stringify(params)).not.toContain('test-cloudinary-secret')

    mockUpload()
    const saved = await call('patch', `/business/listings/${listing.id}`, owner.token, {
      logoPublicId: params.public_id,
    })
    expect(saved.body.data.logoUrl).toBe(
      `https://res.cloudinary.com/atk-test/image/upload/v1/${params.public_id}.jpg`,
    )

    const elsewhere = await call('patch', `/business/listings/${listing.id}`, owner.token, {
      logoPublicId: `atk-test/listings/${listing.id}x/logo-abc`,
    })
    expect(elsewhere.status).toBe(400)

    vi.restoreAllMocks()
    mockUpload({ bytes: 9_000_000 })
    const tooBig = await call('patch', `/business/listings/${listing.id}`, owner.token, {
      logoPublicId: `atk-test/listings/${listing.id}/logo-big`,
    })
    expect(tooBig.status).toBe(400)
    expect((await jobs(QUEUE.MEDIA)).map((j) => j.data.publicId)).toContain(
      `atk-test/listings/${listing.id}/logo-big`,
    )
  })
})

describe('Featured features', () => {
  it('needs an active Featured subscription for media and offers', async () => {
    const sign = await call('post', `/business/listings/${listing.id}/media/sign`, owner.token)
    expect(sign.body.error.code).toBe('FEATURED_REQUIRED')
    expect((await call('get', `/business/listings/${listing.id}/offers`, owner.token)).status).toBe(
      403,
    )

    // An expired subscription does not count.
    const sub = await makeFeatured(listing.id)
    await db.subscription.update({
      where: { id: sub.id },
      data: { endsAt: new Date(Date.now() - 1000) },
    })
    expect(
      (await call('post', `/business/listings/${listing.id}/media/sign`, owner.token)).status,
    ).toBe(403)
  })

  it('enforces the plan limits for photos and videos', async () => {
    await makeFeatured(listing.id)
    mockUpload()
    const { public_id: publicId } = (
      await call('post', `/business/listings/${listing.id}/media/sign`, owner.token)
    ).body.data
    const photo = await call('post', `/business/listings/${listing.id}/media`, owner.token, {
      type: 'PHOTO',
      publicId,
      altText: 'Front',
    })
    expect(photo.status).toBe(201)

    const second = await call('post', `/business/listings/${listing.id}/media/sign`, owner.token)
    expect(second.body.error.code).toBe('PLAN_LIMIT')

    const badVideo = await call('post', `/business/listings/${listing.id}/media`, owner.token, {
      type: 'VIDEO',
      url: 'https://vimeo.com/1',
      altText: 'Tour',
    })
    expect(badVideo.status).toBe(400)
    const video = await call('post', `/business/listings/${listing.id}/media`, owner.token, {
      type: 'VIDEO',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      altText: 'Tour',
    })
    expect(video.status).toBe(201)

    const detail = await call('get', `/business/listings/${listing.id}`, owner.token)
    const ids = detail.body.data.media.map((m) => m.id)
    await call('patch', `/business/listings/${listing.id}/media/order`, owner.token, {
      ids: [...ids].reverse(),
    })
    const reordered = await call('get', `/business/listings/${listing.id}`, owner.token)
    expect(reordered.body.data.media.map((m) => m.id)).toEqual([...ids].reverse())

    await call(
      'delete',
      `/business/listings/${listing.id}/media/${photo.body.data.id}`,
      owner.token,
    )
    expect((await jobs(QUEUE.MEDIA)).map((j) => j.data.publicId)).toContain(publicId)
  })

  it('manages offers', async () => {
    await makeFeatured(listing.id)
    const start = new Date()
    const offer = await call('post', `/business/listings/${listing.id}/offers`, owner.token, {
      title: '10% off momo',
      startsAt: start,
      endsAt: new Date(start.getTime() + 7 * DAY),
    })
    expect(offer.status).toBe(201)
    const bad = await call(
      'patch',
      `/business/listings/${listing.id}/offers/${offer.body.data.id}`,
      owner.token,
      {
        endsAt: new Date(start.getTime() - DAY),
      },
    )
    expect(bad.status).toBe(400)
    await call(
      'patch',
      `/business/listings/${listing.id}/offers/${offer.body.data.id}`,
      owner.token,
      { isActive: false },
    )
    expect((await db.offer.findUnique({ where: { id: offer.body.data.id } })).isActive).toBe(false)
    await call(
      'delete',
      `/business/listings/${listing.id}/offers/${offer.body.data.id}`,
      owner.token,
    )
    expect(await db.offer.count()).toBe(0)
  })
})

describe('stats, plan and invoices', () => {
  it('returns every day in the range with totals, max 365 days', async () => {
    await db.listingStatDaily.createMany({
      data: [
        { businessId: listing.id, date: new Date('2026-10-01'), views: 5, calls: 2 },
        { businessId: listing.id, date: new Date('2026-10-03'), views: 1, whatsapp: 1 },
      ],
    })
    const res = await call(
      'get',
      `/business/listings/${listing.id}/stats?from=2026-10-01&to=2026-10-03`,
      owner.token,
    )
    expect(res.body.data.days.map((d) => [d.date, d.views])).toEqual([
      ['2026-10-01', 5],
      ['2026-10-02', 0],
      ['2026-10-03', 1],
    ])
    expect(res.body.data.totals).toMatchObject({ views: 6, calls: 2, whatsapp: 1 })
    expect(
      (await call('get', `/business/listings/${listing.id}/stats`, owner.token)).body.data.days,
    ).toHaveLength(30)
    expect(
      (
        await call(
          'get',
          `/business/listings/${listing.id}/stats?from=2024-01-01&to=2026-10-01`,
          owner.token,
        )
      ).status,
    ).toBe(400)
  })

  it('shows the current plan and completed payments as invoices', async () => {
    const sub = await makeFeatured(listing.id)
    await db.payment.createMany({
      data: [
        {
          subscriptionId: sub.id,
          businessId: listing.id,
          gateway: 'KHALTI',
          gatewayRef: 'p1',
          amountNpr: 4000,
          status: 'COMPLETED',
          invoiceNo: 'ATK-1',
          verifiedAt: new Date(),
        },
        {
          subscriptionId: sub.id,
          businessId: listing.id,
          gateway: 'ESEWA',
          gatewayRef: 'p2',
          amountNpr: 4000,
          status: 'FAILED',
        },
      ],
    })
    const plan = await call('get', `/business/listings/${listing.id}/subscription`, owner.token)
    expect(plan.body.data.current.plan.name).toBe('Featured')
    const invoices = await call('get', `/business/listings/${listing.id}/invoices`, owner.token)
    expect(invoices.body.data.map((p) => p.invoiceNo)).toEqual(['ATK-1'])
  })
})

describe('claims and new listings (members)', () => {
  it('claims a live, unmanaged listing once, optionally with a proof document', async () => {
    const member = await session('MEMBER')
    const free = await createListing({ name: 'Free Cafe' })
    const draft = await createListing({ status: 'DRAFT' })

    expect((await call('post', '/me/claims', member.token, { businessId: free.id })).status).toBe(
      400,
    )
    const sign = await call('post', '/me/claims/proof/sign', member.token)
    mockUpload()
    const claim = await call('post', '/me/claims', member.token, {
      businessId: free.id,
      note: 'Call the shop on 01-4000000',
      proofPublicId: sign.body.data.public_id,
    })
    expect(claim.status).toBe(201)
    expect(claim.body.data.proofUrl).toContain(sign.body.data.public_id)

    expect(
      (await call('post', '/me/claims', member.token, { businessId: free.id, note: 'again' }))
        .status,
    ).toBe(409)
    expect(
      (await call('post', '/me/claims', member.token, { businessId: listing.id, note: 'mine' }))
        .status,
    ).toBe(409)
    expect(
      (await call('post', '/me/claims', member.token, { businessId: draft.id, note: 'x' })).status,
    ).toBe(404)
    expect((await call('get', '/me/claims', member.token)).body.data.map((c) => c.status)).toEqual([
      'PENDING',
    ])
  })

  it('"List your business" creates a pending listing that makes the member an owner when it goes live', async () => {
    const member = await session('MEMBER')
    const res = await call('post', '/me/listings', member.token, {
      name: 'New Momo',
      shortDesc: 'Momo shop',
      categoryIds: [category.id],
    })
    expect(res.body.data.status).toBe('PENDING')

    const admin = await session('ADMIN', { totpEnabled: true })
    const { accessToken } = await createSession(admin.user, { mfa: true })
    // Admin completes what the publish rules need, then publishes.
    const area = await db.area.create({
      data: { slug: 'patan', nameEn: 'Patan', district: 'Lalitpur' },
    })
    await call('patch', `/admin/listings/${res.body.data.id}`, accessToken, {
      areaId: area.id,
      location: { lat: 27.673, lng: 85.325 },
    })
    const published = await call(
      'post',
      `/admin/listings/${res.body.data.id}/status`,
      accessToken,
      { status: 'LIVE' },
    )
    expect(published.status).toBe(200)
    expect((await db.user.findUnique({ where: { id: member.user.id } })).role).toBe(
      'BUSINESS_OWNER',
    )
  })

  it('lets admins list and remove media', async () => {
    const media = await db.media.create({
      data: {
        businessId: listing.id,
        type: 'PHOTO',
        url: 'https://res.cloudinary.com/x.jpg',
        publicId: 'atk-test/x',
        altText: 'x',
      },
    })
    const admin = await createUser({ role: 'ADMIN', totpEnabled: true })
    const { accessToken } = await createSession(admin, { mfa: true })
    expect((await call('get', '/admin/media', accessToken)).body.data.map((m) => m.id)).toEqual([
      media.id,
    ])
    await call('delete', `/admin/media/${media.id}`, accessToken)
    expect(await db.media.count()).toBe(0)
    expect((await jobs(QUEUE.MEDIA)).map((j) => j.data.publicId)).toContain('atk-test/x')
  })
})
