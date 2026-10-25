import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { nepalClock } from '../src/lib/hours.js'
import { redis } from '../src/config/redis.js'
import { createSession } from '../src/services/token.js'
import { pageTagsFor, sendRevalidate } from '../src/services/revalidate.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { refreshCategoryCounts } from '../src/services/listingSync.js'
import { resetDb, createListing } from './helpers/db.js'
import { createUser, flushRedis } from './helpers/auth.js'

const app = createApp()
const report = (body, token) => {
  const req = request(app).post('/api/v1/public/reports').send(body)
  return token ? req.set('Authorization', `Bearer ${token}`) : req
}

beforeEach(async () => {
  await resetDb()
  await flushRedis()
})
afterEach(() => vi.unstubAllGlobals())

describe('POST /reports', () => {
  it('accepts a guest report for a live listing', async () => {
    const listing = await createListing()
    const res = await report({ entityType: 'BUSINESS', entityId: listing.id, reason: 'closed' })
    expect(res.status).toBe(201)
    const [saved] = await db.report.findMany()
    expect(saved).toMatchObject({
      entityType: 'BUSINESS',
      entityId: listing.id,
      reason: 'closed',
      userId: null,
      status: 'OPEN',
    })
  })

  it('keeps the reporter when logged in', async () => {
    const listing = await createListing()
    const user = await createUser()
    const { accessToken } = await createSession(user, { mfa: false })
    await report(
      { entityType: 'BUSINESS', entityId: listing.id, reason: 'wrong_hours' },
      accessToken,
    )
    expect((await db.report.findFirst()).userId).toBe(user.id)
  })

  it('refuses hidden content, bad input and too many reports', async () => {
    const draft = await createListing({ status: 'DRAFT' })
    expect(
      (await report({ entityType: 'BUSINESS', entityId: draft.id, reason: 'closed' })).status,
    ).toBe(404)
    const listing = await createListing()
    expect(
      (await report({ entityType: 'BUSINESS', entityId: listing.id, reason: 'other' })).status,
    ).toBe(400)
    expect(
      (await report({ entityType: 'BUSINESS', entityId: listing.id, reason: 'nope' })).status,
    ).toBe(400)

    for (let i = 0; i < 2; i += 1)
      await report({ entityType: 'BUSINESS', entityId: listing.id, reason: 'spam' })
    const sixth = await report({ entityType: 'BUSINESS', entityId: listing.id, reason: 'spam' })
    expect(sixth.status).toBe(429)
  })
})

describe('track beacons', () => {
  it('accepts text/plain JSON bodies (sendBeacon)', async () => {
    const listing = await createListing()
    const res = await request(app)
      .post('/api/v1/public/track')
      .set('Content-Type', 'text/plain;charset=UTF-8')
      .send(JSON.stringify({ businessId: listing.id, kind: 'call' }))
    expect(res.status).toBe(204)
    expect(await redis.hget(`stats:${nepalClock().date}:${listing.id}`, 'calls')).toBe('1')
  })
})

describe('page revalidation', () => {
  it('builds both id and slug tags, including a previous slug', () => {
    expect(
      pageTagsFor({
        listings: [{ id: 'L1', slug: 'new-name', oldSlug: 'old-name' }],
        categories: [{ id: 'C1', slug: 'cafes' }],
        extra: ['home'],
      }).sort(),
    ).toEqual([
      'category:C1',
      'category:cafes',
      'home',
      'listing:L1',
      'listing:new-name',
      'listing:old-name',
    ])
  })

  it('posts tags to the web app with the shared secret', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, json: async () => ({ revalidated: 1 }) })),
    )
    await sendRevalidate(['home'])
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('http://localhost:3000/api/revalidate')
    expect(init.headers['x-revalidate-secret']).toBe(process.env.REVALIDATE_SECRET)
    expect(JSON.parse(init.body)).toEqual({ tags: ['home'] })

    fetch.mockResolvedValueOnce({ ok: false, status: 401 })
    await expect(sendRevalidate(['home'])).rejects.toThrow('401')
  })

  it('queues revalidation when a category count changes', async () => {
    const cat = await db.category.create({ data: { slug: 'cafes', nameEn: 'Cafes' } })
    await createListing({ categories: { create: { categoryId: cat.id, isPrimary: true } } })
    await refreshCategoryCounts()
    const [job] = await getQueue(QUEUE.REVALIDATE).getJobs(['waiting'])
    expect(job.data.tags).toEqual(
      expect.arrayContaining(['groups', 'home', `category:${cat.id}`, 'category:cafes']),
    )
  })
})
