import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { redis } from '../src/config/redis.js'
import { purgeTags } from '../src/services/cache.js'
import { resetSynonymCache } from '../src/services/search.js'
import { resetDb } from './helpers/db.js'
import { createUser, flushRedis } from './helpers/auth.js'
import { LIVE_RESTAURANTS, THAMEL, seedDirectory } from './helpers/directory.js'

const app = createApp()
const get = (path) => request(app).get(`/api/v1/public${path}`)

let fx

beforeAll(async () => {
  await resetDb()
  resetSynonymCache()
  fx = await seedDirectory()
})

beforeEach(flushRedis)

/** Follows nextCursor until the end; returns every page. */
async function allPages(path, limit, pick = (data) => data) {
  const pages = []
  let cursor
  do {
    const sep = path.includes('?') ? '&' : '?'
    const res = await get(`${path}${sep}limit=${limit}${cursor ? `&cursor=${cursor}` : ''}`)
    expect(res.status).toBe(200)
    pages.push(pick(res.body.data))
    cursor = res.body.meta.nextCursor
  } while (cursor)
  return pages
}

describe('GET /groups and /categories/:slug', () => {
  it('lists visible groups with every category that has a live listing', async () => {
    const res = await get('/groups')
    expect(res.status).toBe(200)
    expect(
      res.body.data.map((g) => [g.slug, g.categories.map((c) => [c.slug, c.liveCount])]),
    ).toEqual([
      [
        'eat-and-drink',
        [
          ['restaurants', 9],
          ['cafes', 2],
        ],
      ],
      ['home-services', [['plumbers', 5]]],
    ])
  })

  it('returns a category with its group and tags, and a group with its categories', async () => {
    const category = (await get('/categories/restaurants')).body.data
    expect(category).toMatchObject({
      slug: 'restaurants',
      isGroup: false,
      liveCount: 9,
      group: { slug: 'eat-and-drink' },
      tags: [{ slug: 'vegetarian' }, { slug: 'rooftop' }],
    })

    const group = (await get('/categories/eat-and-drink')).body.data
    expect(group).toMatchObject({ isGroup: true, group: null })
    expect(group.categories.map((c) => c.slug)).toEqual(['restaurants', 'cafes'])
  })

  it('hides empty categories, market categories and unknown slugs', async () => {
    // Cafes has only 2 live listings and still has a page.
    expect((await get('/categories/cafes')).status).toBe(200)
    await db.category.create({
      data: { slug: 'bakeries', nameEn: 'Bakeries', parentId: fx.categories.eat.id },
    })
    expect((await get('/categories/bakeries')).status).toBe(404)
    expect((await get('/categories/market-electronics')).status).toBe(404)
    expect((await get('/categories/nope')).status).toBe(404)
    expect((await get('/categories/Bad_Slug!')).status).toBe(400)
  })
})

describe('GET /categories/:slug/listings', () => {
  it('pages through every live listing exactly once, with at most 2 Featured per page', async () => {
    const pages = await allPages('/categories/restaurants/listings', 4)
    const slugs = pages.flat().map((c) => c.slug)
    expect(slugs.sort()).toEqual([...LIVE_RESTAURANTS].sort())

    for (const page of pages) {
      const featured = page.filter((c) => c.featured)
      // Featured cards sit on top of the page.
      expect(page.slice(0, featured.length).every((c) => c.featured)).toBe(true)
      const organicLeft = page.some((c) => !c.featured)
      if (organicLeft) expect(featured.length).toBeLessThanOrEqual(2)
    }
    expect(pages[0].filter((c) => c.featured)).toHaveLength(2)
  })

  it('orders organic results by profile completeness without a location', async () => {
    const page = (await get('/categories/restaurants/listings?limit=20')).body.data
    const organic = page.filter((c) => !c.featured)
    expect(organic[0].slug).toBe('pizza-palace') // the most complete profile
  })

  it('sorts by distance when lat/lng are sent, listings without a pin last, and does not cache', async () => {
    const res = await get(
      `/categories/restaurants/listings?lat=${THAMEL.lat}&lng=${THAMEL.lng}&limit=20`,
    )
    expect(res.headers['x-cache']).toBeUndefined()
    const organic = res.body.data.filter((c) => !c.featured)
    expect(organic.slice(0, 4).map((c) => c.slug)).toEqual([
      'pizza-palace', // ~30 m
      'momo-house', // ~100 m
      'thakali-bhanchha', // ~4.79 km
      'newari-kitchen', // ~4.83 km
    ])
    expect(organic[0].distanceMeters).toBeLessThan(100)
    expect(organic.at(-1).distanceMeters).toBeNull()
  })

  it('returns the card shape', async () => {
    const card = (await get('/categories/restaurants/listings?limit=20')).body.data.find(
      (c) => c.slug === 'pizza-palace',
    )
    expect(card).toMatchObject({
      name: 'Pizza Palace',
      type: 'BUSINESS',
      shortDesc: 'Wood-fired pizza',
      featured: false,
      openNow: true,
      priceLevel: 2,
      rating: { average: 4.5, count: 0 },
      contact: { phone: '014000001' },
      area: { slug: 'thamel', nameEn: 'Thamel', nameNe: 'ठमेल' },
      category: { slug: 'restaurants', groupSlug: 'eat-and-drink', isPublic: true },
      location: { lat: expect.closeTo(27.7156, 4), lng: expect.closeTo(85.3125, 4) },
    })
  })

  it('marks categories without a public page (hidden by Admin)', async () => {
    expect((await get('/listings/bean-cafe')).body.data.category.isPublic).toBe(true)
    await db.category.update({ where: { slug: 'cafes' }, data: { isVisible: false } })
    await flushRedis()
    const detail = (await get('/listings/bean-cafe')).body.data
    expect(detail.category).toMatchObject({ slug: 'cafes', isPublic: false })
    const cards = (await get('/search?q=cafe')).body.data.results
    expect(cards.find((c) => c.slug === 'bean-cafe').category.isPublic).toBe(false)
    expect((await get('/listings/pizza-palace')).body.data.category.isPublic).toBe(true)
    await db.category.update({ where: { slug: 'cafes' }, data: { isVisible: true } })
  })

  it.each([
    ['area=patan', ['featured-one', 'food-app', 'newari-kitchen', 'thakali-bhanchha']],
    ['tags=vegetarian', ['momo-house', 'pizza-palace']],
    ['tags=vegetarian,rooftop', ['momo-house']],
    ['open=true', ['pizza-palace']],
    ['price=1,3', ['momo-house', 'thakali-bhanchha']],
    ['rating=4', ['momo-house', 'pizza-palace']],
    ['area=nowhere', []],
    ['tags=unknown', []],
  ])('filters with %s', async (query, expected) => {
    const res = await get(`/categories/restaurants/listings?${query}&limit=50`)
    expect(res.status).toBe(200)
    expect(res.body.data.map((c) => c.slug).sort()).toEqual(expected)
  })

  it('rejects bad input and tampered cursors', async () => {
    expect((await get('/categories/restaurants/listings?limit=51')).status).toBe(400)
    expect((await get('/categories/restaurants/listings?lat=27.7')).status).toBe(400)
    expect((await get('/categories/restaurants/listings?price=9')).status).toBe(400)
    const bad = await get('/categories/restaurants/listings?cursor=bm90LWEtY3Vyc29y')
    expect(bad.status).toBe(400)
  })
})

describe('GET /listings/:slug', () => {
  it('returns detail with location and hours, without media for non-Featured listings', async () => {
    await db.media.create({
      data: {
        businessId: fx.listings['pizza-palace'].id,
        type: 'PHOTO',
        url: 'https://res.cloudinary.com/x.jpg',
        altText: 'Pizza',
      },
    })
    const res = await get('/listings/pizza-palace')
    expect(res.status).toBe(200)
    expect(res.body.data).toMatchObject({
      slug: 'pizza-palace',
      featured: false,
      openNow: true,
      location: { lat: expect.closeTo(27.7156, 4), lng: expect.closeTo(85.3125, 4) },
      category: { slug: 'restaurants', groupSlug: 'eat-and-drink' },
      tags: [{ slug: 'vegetarian' }],
      media: [],
      offers: [],
    })
  })

  it('shows media and active offers only for Featured listings', async () => {
    const id = fx.listings['featured-one'].id
    await db.media.create({
      data: {
        businessId: id,
        type: 'PHOTO',
        url: 'https://res.cloudinary.com/f.jpg',
        altText: 'Inside',
      },
    })
    const day = 24 * 3600 * 1000
    await db.offer.createMany({
      data: [
        {
          businessId: id,
          title: 'Now',
          startsAt: new Date(Date.now() - day),
          endsAt: new Date(Date.now() + day),
        },
        {
          businessId: id,
          title: 'Past',
          startsAt: new Date(Date.now() - 3 * day),
          endsAt: new Date(Date.now() - day),
        },
        {
          businessId: id,
          title: 'Paused',
          isActive: false,
          startsAt: new Date(Date.now() - day),
          endsAt: new Date(Date.now() + day),
        },
      ],
    })
    const data = (await get('/listings/featured-one')).body.data
    expect(data.featured).toBe(true)
    expect(data.media).toEqual([expect.objectContaining({ type: 'PHOTO', altText: 'Inside' })])
    expect(data.offers.map((o) => o.title)).toEqual(['Now'])
  })

  it('404s for draft, deleted and unknown listings', async () => {
    for (const slug of ['expired-feature', 'deleted-place', 'nope']) {
      expect((await get(`/listings/${slug}`)).status).toBe(404)
    }
  })

  it('lists approved reviews newest first with first names only, paged by cursor', async () => {
    const id = fx.listings['momo-house'].id
    for (const [i, status] of ['APPROVED', 'APPROVED', 'APPROVED', 'PENDING'].entries()) {
      const user = await createUser({ name: `Reviewer${i} Lastname` })
      await db.review.create({
        data: {
          businessId: id,
          userId: user.id,
          rating: 5 - i,
          status,
          createdAt: new Date(Date.now() - i * 60_000),
        },
      })
    }
    const pages = await allPages('/listings/momo-house/reviews', 2)
    const reviews = pages.flat()
    expect(reviews.map((r) => r.rating)).toEqual([5, 4, 3])
    expect(reviews[0].author.name).toBe('Reviewer0')
  })

  it('suggests similar listings from the same category, nearest first', async () => {
    const res = await get('/listings/pizza-palace/similar?limit=3')
    expect(res.body.data.map((c) => c.slug)).toEqual([
      'momo-house',
      'featured-one', // Featured listings count as similar too
      'thakali-bhanchha',
    ])
  })
})

describe('GET /search', () => {
  const search = (q, extra = '') => get(`/search?q=${encodeURIComponent(q)}${extra}`)

  it('finds by name, prefix and typo', async () => {
    expect((await search('pizza')).body.data.results[0].slug).toBe('pizza-palace')
    expect((await search('piz')).body.data.results.map((r) => r.slug)).toContain('pizza-palace')
    expect((await search('pizzza palace')).body.data.results[0].slug).toBe('pizza-palace')
  })

  it('matches category and area names through searchExtra', async () => {
    const results = (await search('plumbers')).body.data.results.map((r) => r.slug)
    expect(results).toHaveLength(5)
    expect(results.every((s) => s.startsWith('fixit-'))).toBe(true)
  })

  it('expands Admin synonyms both ways', async () => {
    const results = (await search('dhara mistri')).body.data.results.map((r) => r.slug)
    expect(results).toHaveLength(5)
  })

  it('returns matching categories and a did-you-mean for near misses', async () => {
    const res = await search('restaurant')
    expect(res.body.data.categories.map((c) => c.slug)).toEqual(['restaurants'])

    const miss = await search('restorantz')
    expect(miss.body.data.didYouMean).toBe('Restaurants')
  })

  it('filters by area and pages with at most 2 Featured per page', async () => {
    const res = await search('featured', '&area=patan')
    expect(res.body.data.results.map((r) => r.slug)).toEqual(['featured-one'])

    const pages = await allPages('/search?q=featured', 1, (data) => data.results)
    expect(
      pages
        .flat()
        .map((r) => r.slug)
        .sort(),
    ).toEqual(['featured-one', 'featured-three', 'featured-two'])
  })

  it('validates the query', async () => {
    expect((await get('/search')).status).toBe(400)
    expect((await get(`/search?q=${'x'.repeat(101)}`)).status).toBe(400)
  })

  it('suggests categories, listings and areas', async () => {
    const res = await get('/search/suggest?q=pa')
    expect(res.body.data.areas.map((a) => a.slug)).toEqual(['patan'])
    const res2 = await get('/search/suggest?q=momo')
    expect(res2.body.data.listings.map((l) => l.slug)).toEqual(['momo-house'])
    const res3 = await get('/search/suggest?q=rest')
    expect(res3.body.data.categories.map((c) => c.slug)).toEqual(['restaurants'])
  })
})

describe('areas, plans, settings, home', () => {
  it('lists areas with centres', async () => {
    const res = await get('/areas')
    expect(res.body.data).toEqual([
      expect.objectContaining({ slug: 'thamel', lat: expect.closeTo(THAMEL.lat, 4) }),
      expect.objectContaining({ slug: 'patan', district: 'Lalitpur' }),
    ])
  })

  it('lists only active plans and only public settings', async () => {
    await db.plan.createMany({
      data: [
        { code: 'BASIC', name: 'Basic', priceNpr: 0, durationDays: 30, features: {} },
        {
          code: 'FEATURED',
          name: 'Featured',
          priceNpr: 4000,
          durationDays: 30,
          features: {},
          isActive: false,
        },
      ],
    })
    await db.setting.createMany({
      data: [
        { key: 'contact', value: { email: 'hello@atk.test' } },
        { key: 'internal_notes', value: { secret: true } },
      ],
    })
    expect((await get('/plans')).body.data.map((p) => p.code)).toEqual(['BASIC'])
    expect((await get('/settings')).body.data).toEqual({ contact: { email: 'hello@atk.test' } })
  })

  it('returns active home sections in order with their data', async () => {
    await db.homeSection.createMany({
      data: [
        { type: 'GROUPS', sortOrder: 0 },
        { type: 'OPEN_NOW', title: 'Open now', sortOrder: 1 },
        { type: 'FEATURED', title: 'Featured', sortOrder: 2 },
        { type: 'POPULAR', title: 'Popular', sortOrder: 3 },
        {
          type: 'BANNER',
          title: 'List your business',
          config: { href: '/business' },
          sortOrder: 4,
        },
        { type: 'EVENTS', title: 'Hidden', sortOrder: 5, isActive: false },
      ],
    })
    await db.listingStatDaily.createMany({
      data: [
        { businessId: fx.listings['momo-house'].id, date: new Date(), views: 50 },
        { businessId: fx.listings['pizza-palace'].id, date: new Date(), views: 10 },
      ],
    })
    const sections = (await get('/home')).body.data
    expect(sections.map((s) => s.type)).toEqual([
      'GROUPS',
      'OPEN_NOW',
      'FEATURED',
      'POPULAR',
      'BANNER',
    ])
    const byType = Object.fromEntries(sections.map((s) => [s.type, s]))
    expect(byType.GROUPS.items.map((g) => g.slug)).toEqual(['eat-and-drink', 'home-services'])
    expect(byType.OPEN_NOW.items.map((c) => c.slug)).toEqual(['pizza-palace'])
    expect(byType.FEATURED.items.map((c) => c.slug).sort()).toEqual([
      'featured-one',
      'featured-three',
      'featured-two',
    ])
    expect(byType.POPULAR.items.map((c) => c.slug)).toEqual(['momo-house', 'pizza-palace'])
    expect(byType.BANNER).toMatchObject({ config: { href: '/business' }, items: null })
  })
})

describe('response cache', () => {
  it('serves repeats from Redis and drops entries when their tag is purged', async () => {
    expect((await get('/categories/restaurants/listings')).headers['x-cache']).toBe('MISS')
    expect((await get('/categories/restaurants/listings')).headers['x-cache']).toBe('HIT')
    // Same query in another parameter order is the same entry.
    await get('/categories/restaurants/listings?limit=5&open=false')
    expect(
      (await get('/categories/restaurants/listings?open=false&limit=5')).headers['x-cache'],
    ).toBe('HIT')

    await purgeTags([`category:${fx.categories.restaurants.id}`])
    expect((await get('/categories/restaurants/listings')).headers['x-cache']).toBe('MISS')
  })

  it('does not cache errors', async () => {
    await get('/listings/nope')
    expect((await get('/listings/nope')).headers['x-cache']).toBe('MISS')
  })

  describe('with Redis down', () => {
    let status
    beforeEach(() => {
      status = redis.status
      redis.status = 'end'
    })
    afterEach(() => {
      redis.status = status
    })

    it('reads straight from the database', async () => {
      const res = await get('/groups')
      expect(res.status).toBe(200)
      expect(res.headers['x-cache']).toBeUndefined()
      expect(res.body.data).toHaveLength(2)
    })
  })
})
