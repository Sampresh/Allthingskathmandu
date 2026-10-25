import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { redis } from '../src/config/redis.js'
import { nepalClock } from '../src/lib/hours.js'
import { flushStats } from '../src/services/stats.js'
import { refreshCategoryCounts, syncListings } from '../src/services/listingSync.js'
import { getCached, setCached } from '../src/services/cache.js'
import { resetDb, createListing } from './helpers/db.js'
import { flushRedis } from './helpers/auth.js'

const app = createApp()
const track = (body, ip = '10.0.0.1') =>
  request(app).post('/api/v1/public/track').set('X-Forwarded-For', ip).send(body)

beforeEach(async () => {
  await resetDb()
  await flushRedis()
})

describe('POST /track and the stats flush', () => {
  it('counts in Redis, dedupes repeat views, and flushes to listing_stats_daily', async () => {
    const listing = await createListing()
    const key = `stats:${nepalClock().date}:${listing.id}`

    expect((await track({ businessId: listing.id, kind: 'view' })).status).toBe(204)
    await track({ businessId: listing.id, kind: 'view' }) // same visitor: counted once
    await track({ businessId: listing.id, kind: 'call' })
    await track({ businessId: listing.id, kind: 'call' })
    await track({ businessId: listing.id, kind: 'map' })
    expect(await redis.hgetall(key)).toEqual({ views: '1', calls: '2', mapClicks: '1' })
    expect(await db.listingStatDaily.count()).toBe(0) // no row per event

    expect(await flushStats()).toEqual({ flushed: 1 })
    expect(await redis.exists(key)).toBe(0)

    await track({ businessId: listing.id, kind: 'whatsapp' })
    await track({ businessId: listing.id, kind: 'website' })
    await flushStats()
    expect(await flushStats()).toEqual({ flushed: 0 })

    const [row] = await db.listingStatDaily.findMany()
    expect(row).toMatchObject({
      businessId: listing.id,
      views: 1,
      calls: 2,
      whatsapp: 1,
      mapClicks: 1,
      websiteClicks: 1,
    })
  })

  it('drops counts for ids that are not listings', async () => {
    await track({ businessId: '01920000-0000-7000-8000-000000000000', kind: 'call' })
    await flushStats()
    expect(await db.listingStatDaily.count()).toBe(0)
  })

  it('validates the body', async () => {
    expect((await track({ businessId: 'nope', kind: 'view' })).status).toBe(400)
    const listing = await createListing()
    expect((await track({ businessId: listing.id, kind: 'like' })).status).toBe(400)
  })
})

describe('directory maintenance jobs', () => {
  it('keeps liveCount per category and group, and purges cached pages that changed', async () => {
    const group = await db.category.create({ data: { slug: 'g', nameEn: 'Group' } })
    const cat = await db.category.create({
      data: { slug: 'c', nameEn: 'Category', parentId: group.id },
    })
    for (const status of ['LIVE', 'LIVE', 'DRAFT']) {
      await createListing({
        status,
        categories: { create: { categoryId: cat.id, isPrimary: true } },
      })
    }
    await setCached('/api/v1/public/groups?', '{"cached":true}', 600, ['groups'])

    expect(await refreshCategoryCounts()).toEqual({ changed: 2 })
    const counts = await db.category.findMany({ orderBy: { slug: 'asc' } })
    expect(counts.map((c) => [c.slug, c.liveCount])).toEqual([
      ['c', 2],
      ['g', 2],
    ])
    expect(await getCached('/api/v1/public/groups?')).toBeNull()
    expect(await refreshCategoryCounts()).toEqual({ changed: 0 })
  })

  it('fills searchExtra and profileScore so category and area names are searchable', async () => {
    const cat = await db.category.create({
      data: { slug: 'plumbers', nameEn: 'Plumbers', nameNe: 'प्लम्बर' },
    })
    const area = await db.area.create({
      data: { slug: 'thamel', nameEn: 'Thamel', district: 'Kathmandu' },
    })
    const listing = await createListing({
      name: 'Fixit',
      areaId: area.id,
      phone: '9800000000',
      categories: { create: { categoryId: cat.id, isPrimary: true } },
    })

    expect(await syncListings([listing.id])).toEqual({ updated: 1 })
    const synced = await db.business.findUnique({ where: { id: listing.id } })
    expect(synced.searchExtra).toBe('Plumbers प्लम्बर Thamel')
    expect(synced.profileScore).toBe(30) // contact 20 + area 10

    const [match] = await db.$queryRaw`
      SELECT id FROM businesses
      WHERE "searchVector" @@ to_tsquery('simple', 'thamel:* & plumb:*')`
    expect(match.id).toBe(listing.id)
    expect(await syncListings()).toEqual({ updated: 0 })
  })
})
