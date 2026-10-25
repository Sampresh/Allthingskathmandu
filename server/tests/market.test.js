import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { cloudinary } from '../src/config/cloudinary.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { expireMarketItems } from '../src/services/market.js'
import { createSession } from '../src/services/token.js'
import { resetDb } from './helpers/db.js'
import { PASSWORD, createUser, flushRedis } from './helpers/auth.js'

const app = createApp()
const DAY = 24 * 60 * 60 * 1000

async function tokenFor(role, data = {}) {
  const staff = !['MEMBER', 'BUSINESS_OWNER'].includes(role)
  const user = await createUser({ role, totpEnabled: staff, ...data })
  const { accessToken } = await createSession(user, { mfa: staff })
  return { user, token: accessToken }
}

const call = (method, path, token, body) => {
  const req = request(app)[method](`/api/v1${path}`)
  if (token) req.set('Authorization', `Bearer ${token}`)
  return body === undefined ? req : req.send(body)
}

const jobs = async (queue) => getQueue(queue).getJobs(['waiting', 'delayed'])

function mockUpload() {
  return vi.spyOn(cloudinary.api, 'resource').mockImplementation(async (publicId) => ({
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/atk-test/image/upload/v1/${publicId}.jpg`,
    bytes: 300_000,
    format: 'jpg',
    width: 1200,
    height: 900,
  }))
}

let seller
let mod
let furniture
let phones
let directory
let baneshwor

const sign = async (token = seller.token) =>
  (await call('post', '/me/market/media/sign', token)).body.data.public_id

const item = (overrides = {}) => ({
  title: 'Wooden study table',
  description: 'Solid sal wood, a few scratches.',
  priceNpr: 4500,
  isNegotiable: true,
  condition: 'GOOD',
  categoryId: furniture.id,
  areaId: baneshwor.id,
  contactPhone: '9801234567',
  photos: [],
  ...overrides,
})

async function post(overrides) {
  const res = await call('post', '/me/market', seller.token, item(overrides))
  expect(res.status).toBe(201)
  return res.body.data
}

async function live(overrides) {
  const created = await post(overrides)
  const res = await call('post', `/admin/market/${created.id}/approve`, mod.token)
  expect(res.status).toBe(200)
  return created
}

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  seller = await tokenFor('MEMBER', { name: 'Ramesh Shrestha' })
  mod = await tokenFor('MODERATOR')
  furniture = await db.category.create({
    data: { kind: 'MARKET', slug: 'market-furniture', nameEn: 'Furniture' },
  })
  phones = await db.category.create({
    data: { kind: 'MARKET', slug: 'market-phones', nameEn: 'Phones' },
  })
  directory = await db.category.create({ data: { slug: 'restaurants', nameEn: 'Restaurants' } })
  baneshwor = await db.area.create({
    data: { slug: 'baneshwor', nameEn: 'Baneshwor', district: 'Kathmandu' },
  })
})
afterEach(() => vi.restoreAllMocks())

describe('posting items', () => {
  it('posts a pending item with checked photos and contact', async () => {
    mockUpload()
    const first = await sign()
    expect(first).toContain(`/market/${seller.user.id}/photo-`)
    const created = await post({ photos: [{ publicId: first, altText: 'Table from the front' }] })
    expect(created).toMatchObject({
      status: 'PENDING',
      expiresAt: null,
      slug: 'wooden-study-table',
    })
    expect(created.photos).toHaveLength(1)
    expect((await post()).slug).toBe('wooden-study-table-2')

    // Not public until approved.
    expect((await call('get', '/public/market')).body.data).toHaveLength(0)
    expect((await call('get', '/me/market', seller.token)).body.data).toHaveLength(2)
  })

  it('validates contact, category, photo count and photo ownership', async () => {
    const noContact = await call(
      'post',
      '/me/market',
      seller.token,
      item({ contactPhone: null, contactWhatsapp: null }),
    )
    expect(noContact.status).toBe(400)
    const wrongKind = await call(
      'post',
      '/me/market',
      seller.token,
      item({ categoryId: directory.id }),
    )
    expect(wrongKind.status).toBe(400)

    mockUpload()
    const seven = await Promise.all(Array.from({ length: 7 }, () => sign()))
    const tooMany = await call(
      'post',
      '/me/market',
      seller.token,
      item({ photos: seven.map((publicId) => ({ publicId, altText: 'Photo' })) }),
    )
    expect(tooMany.status).toBe(400)
    const noAlt = await call(
      'post',
      '/me/market',
      seller.token,
      item({ photos: [{ publicId: seven[0], altText: '' }] }),
    )
    expect(noAlt.status).toBe(400)

    const other = await tokenFor('MEMBER')
    const theirs = await sign(other.token)
    const stolen = await call(
      'post',
      '/me/market',
      seller.token,
      item({ photos: [{ publicId: theirs, altText: 'Not mine' }] }),
    )
    expect(stolen.status).toBe(400)
    expect((await call('post', '/me/market', null, item())).status).toBe(401)
  })
})

describe('public market', () => {
  it('shows approved items for 30 days with filters and cursor pages', async () => {
    mockUpload()
    const photo = await sign()
    const table = await live({ photos: [{ publicId: photo, altText: 'Table' }] })
    await live({
      title: 'iPhone 12 128GB',
      categoryId: phones.id,
      condition: 'LIKE_NEW',
      priceNpr: 52000,
      areaId: null,
      contactPhone: null,
      contactWhatsapp: '9812345678',
    })
    await post({ title: 'Pending chair' })

    const approvedRow = await db.marketItem.findUnique({ where: { id: table.id } })
    expect(approvedRow.expiresAt.getTime() - Date.now()).toBeGreaterThan(29.9 * DAY)

    const all = await call('get', '/public/market?limit=1')
    expect(all.body.data.map((i) => i.title)).toEqual(['iPhone 12 128GB'])
    const next = await call('get', `/public/market?limit=1&cursor=${all.body.meta.nextCursor}`)
    expect(next.body.data.map((i) => i.title)).toEqual(['Wooden study table'])
    expect(next.body.data[0].photo.altText).toBe('Table')

    const titles = async (query) =>
      (await call('get', `/public/market?${query}`)).body.data.map((i) => i.title)
    expect(await titles('category=market-phones')).toEqual(['iPhone 12 128GB'])
    expect(await titles('condition=GOOD')).toEqual(['Wooden study table'])
    expect(await titles('min=10000&max=60000')).toEqual(['iPhone 12 128GB'])
    expect(await titles('area=baneshwor')).toEqual(['Wooden study table'])
    expect(await titles('q=iphone')).toEqual(['iPhone 12 128GB'])
    expect((await call('get', '/public/market?min=5&max=1')).status).toBe(400)

    const detail = await call('get', `/public/market/${table.slug}`)
    expect(detail.body.data).toMatchObject({
      title: 'Wooden study table',
      seller: { firstName: 'Ramesh' },
      contact: { phone: '9801234567', whatsapp: null },
      category: { slug: 'market-furniture' },
      isNegotiable: true,
    })
    expect(detail.body.data.seller.email).toBeUndefined()

    const cats = await call('get', '/public/market/categories')
    expect(cats.body.data.map((c) => c.slug)).toEqual(['market-furniture', 'market-phones'])
  })

  it('hides an item once its 30 days pass, before and after the expiry job', async () => {
    const table = await live()
    await db.marketItem.update({
      where: { id: table.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    })
    expect((await call('get', `/public/market/${table.slug}`)).status).toBe(404)

    expect(await expireMarketItems()).toEqual({ expired: 1 })
    expect((await db.marketItem.findUnique({ where: { id: table.id } })).status).toBe('EXPIRED')
    const emails = (await jobs(QUEUE.EMAIL)).filter((j) => j.data.template === 'market-expired')
    expect(emails).toHaveLength(1)
    expect(emails[0].data).toMatchObject({
      to: seller.user.email,
      data: { title: 'Wooden study table', name: 'Ramesh' },
    })
    expect(await expireMarketItems()).toEqual({ expired: 0 })
  })
})

describe('managing my items', () => {
  it('sends edits back to moderation and swaps photos', async () => {
    mockUpload()
    const [a, b] = [await sign(), await sign()]
    const table = await live({ photos: [{ publicId: a, altText: 'Front' }] })
    await flushRedis()

    const edited = await call('patch', `/me/market/${table.id}`, seller.token, {
      priceNpr: 4000,
      photos: [{ publicId: b, altText: 'Side' }],
    })
    expect(edited.body.data).toMatchObject({ status: 'PENDING', priceNpr: 4000, expiresAt: null })
    expect(edited.body.data.photos.map((p) => p.publicId)).toEqual([b])
    expect((await jobs(QUEUE.MEDIA)).map((j) => j.data.publicId)).toEqual([a])
    expect((await jobs(QUEUE.REVALIDATE)).flatMap((j) => j.data.tags)).toContain(
      `market:${table.slug}`,
    )
    expect((await call('get', '/public/market')).body.data).toHaveLength(0)

    const clearContact = await call('patch', `/me/market/${table.id}`, seller.token, {
      contactPhone: null,
    })
    expect(clearContact.status).toBe(400)

    const other = await tokenFor('MEMBER')
    expect(
      (await call('patch', `/me/market/${table.id}`, other.token, { priceNpr: 1 })).status,
    ).toBe(404)
    expect((await call('delete', `/me/market/${table.id}`, other.token)).status).toBe(404)
  })

  it('marks live items sold and deletes items', async () => {
    const table = await live()
    expect((await call('post', `/me/market/${table.id}/sold`, seller.token)).body.data.status).toBe(
      'SOLD',
    )
    expect((await call('get', `/public/market/${table.slug}`)).status).toBe(404)
    expect(
      (await call('patch', `/me/market/${table.id}`, seller.token, { priceNpr: 1 })).status,
    ).toBe(400)
    expect((await call('post', `/me/market/${table.id}/sold`, seller.token)).status).toBe(400)

    expect((await call('delete', `/me/market/${table.id}`, seller.token)).status).toBe(204)
    expect((await call('get', '/me/market', seller.token)).body.data).toHaveLength(0)
    expect((await db.marketItem.findUnique({ where: { id: table.id } })).deletedAt).not.toBeNull()
  })

  it('removes a member’s items when they delete their account', async () => {
    await live()
    const res = await call('delete', '/me', seller.token, { password: PASSWORD, confirm: 'DELETE' })
    expect(res.status).toBe(204)
    expect(await db.marketItem.count({ where: { deletedAt: null } })).toBe(0)
    expect((await call('get', '/public/market')).body.data).toHaveLength(0)
  })
})

describe('market moderation', () => {
  it('is for moderators, audited, and can reject or remove', async () => {
    const pending = await post()
    expect((await call('get', '/admin/market', seller.token)).status).toBe(403)
    const queue = await call('get', '/admin/market', mod.token)
    expect(queue.body.data[0]).toMatchObject({ id: pending.id, seller: { id: seller.user.id } })

    await call('post', `/admin/market/${pending.id}/reject`, mod.token, { reason: 'Blurry' })
    expect((await db.marketItem.findUnique({ where: { id: pending.id } })).status).toBe('REJECTED')
    const rejected = await call('get', '/admin/market?status=REJECTED', mod.token)
    expect(rejected.body.data).toHaveLength(1)

    const table = await live({ title: 'Sofa' })
    expect((await call('delete', `/admin/market/${table.id}`, mod.token)).status).toBe(204)
    expect((await call('get', '/public/market')).body.data).toHaveLength(0)
    const actions = (await db.auditLog.findMany()).map((l) => l.action)
    expect(actions).toEqual(
      expect.arrayContaining(['market.submit', 'market.reject', 'market.approve', 'market.delete']),
    )
  })
})
