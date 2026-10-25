import { db } from '../../src/config/db.js'
import { setAreaCenter, setBusinessLocation } from '../../src/services/geo.js'
import { refreshCategoryCounts, syncListings } from '../../src/services/listingSync.js'

export const ALWAYS_OPEN = Object.fromEntries(
  ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].map((d) => [d, [['00:00', '24:00']]]),
)
export const NEVER_OPEN = { sun: [], mon: [], tue: [], wed: [], thu: [], fri: [], sat: [] }

// Thamel Chowk and Patan Durbar Square.
export const THAMEL = { lat: 27.7154, lng: 85.3123 }
export const PATAN = { lat: 27.673, lng: 85.325 }

const inFuture = () => new Date(Date.now() + 30 * 24 * 3600 * 1000)

/**
 * A small directory:
 * - group "eat-and-drink" with "restaurants" (9 LIVE, 3 of them Featured) and "cafes" (2 LIVE,
 *   below the public threshold); group "home-services" with "plumbers" (5 LIVE)
 * - areas thamel and patan; tags vegetarian and rooftop on restaurants
 * - a DRAFT and a deleted restaurant that must never show
 */
export async function seedDirectory() {
  const eat = await db.category.create({
    data: { slug: 'eat-and-drink', nameEn: 'Eat & Drink', nameNe: 'खानपान', sortOrder: 0 },
  })
  const home = await db.category.create({
    data: { slug: 'home-services', nameEn: 'Home Services', sortOrder: 1 },
  })
  const restaurants = await db.category.create({
    data: { slug: 'restaurants', nameEn: 'Restaurants', nameNe: 'रेस्टुरेन्ट', parentId: eat.id },
  })
  const cafes = await db.category.create({
    data: { slug: 'cafes', nameEn: 'Cafes', parentId: eat.id, sortOrder: 1 },
  })
  const plumbers = await db.category.create({
    data: { slug: 'plumbers', nameEn: 'Plumbers', parentId: home.id },
  })
  await db.category.create({
    data: { slug: 'market-electronics', nameEn: 'Electronics', kind: 'MARKET' },
  })

  const thamel = await db.area.create({
    data: { slug: 'thamel', nameEn: 'Thamel', nameNe: 'ठमेल', district: 'Kathmandu', sortOrder: 0 },
  })
  const patan = await db.area.create({
    data: { slug: 'patan', nameEn: 'Patan', district: 'Lalitpur', sortOrder: 1 },
  })
  await setAreaCenter(db, thamel.id, THAMEL)
  await setAreaCenter(db, patan.id, PATAN)

  const vegetarian = await db.tag.create({
    data: { slug: 'vegetarian', nameEn: 'Vegetarian', categoryId: restaurants.id },
  })
  const rooftop = await db.tag.create({
    data: { slug: 'rooftop', nameEn: 'Rooftop', categoryId: restaurants.id, sortOrder: 1 },
  })

  const listings = {}
  const add = async (key, { category, tags = [], point, ...data }) => {
    const listing = await db.business.create({
      data: {
        slug: key,
        name: data.name ?? key,
        shortDesc: data.shortDesc ?? `About ${key}`,
        status: 'LIVE',
        ...data,
        categories: { create: { categoryId: category.id, isPrimary: true } },
        tags: { create: tags.map((t) => ({ tagId: t.id })) },
      },
    })
    if (point) await setBusinessLocation(db, listing.id, point)
    listings[key] = listing
    return listing
  }

  await add('pizza-palace', {
    category: restaurants,
    name: 'Pizza Palace',
    shortDesc: 'Wood-fired pizza',
    areaId: thamel.id,
    point: { lat: 27.7156, lng: 85.3125 },
    hours: ALWAYS_OPEN,
    priceLevel: 2,
    ratingAvg: 4.5,
    tags: [vegetarian],
    phone: '014000001',
    logoUrl: 'https://res.cloudinary.com/demo/logo.png',
  })
  await add('momo-house', {
    category: restaurants,
    name: 'Momo House',
    shortDesc: 'Steamed and fried momo',
    areaId: thamel.id,
    point: { lat: 27.716, lng: 85.313 },
    hours: NEVER_OPEN,
    priceLevel: 1,
    ratingAvg: 4.0,
    tags: [vegetarian, rooftop],
  })
  await add('newari-kitchen', {
    category: restaurants,
    name: 'Newari Kitchen',
    areaId: patan.id,
    point: { lat: 27.6735, lng: 85.3255 },
    priceLevel: 2,
    ratingAvg: 3.5,
  })
  await add('thakali-bhanchha', {
    category: restaurants,
    name: 'Thakali Bhanchha',
    areaId: patan.id,
    point: { lat: 27.674, lng: 85.326 },
    priceLevel: 3,
  })
  await add('dal-bhat-corner', {
    category: restaurants,
    name: 'Dal Bhat Corner',
    areaId: thamel.id,
  })
  await add('food-app', {
    category: restaurants,
    name: 'Food App',
    type: 'APP',
    playStoreUrl: 'https://play.google.com/x',
  })
  await add('featured-one', {
    category: restaurants,
    name: 'Featured One',
    featuredUntil: inFuture(),
    areaId: patan.id,
    point: { lat: 27.675, lng: 85.327 },
  })
  await add('featured-two', {
    category: restaurants,
    name: 'Featured Two',
    featuredUntil: inFuture(),
    areaId: thamel.id,
  })
  await add('featured-three', {
    category: restaurants,
    name: 'Featured Three',
    featuredUntil: inFuture(),
  })
  await add('expired-feature', {
    category: restaurants,
    name: 'Expired Feature',
    featuredUntil: new Date(Date.now() - 1000),
    status: 'DRAFT',
  })
  await add('deleted-place', {
    category: restaurants,
    name: 'Deleted Place',
    deletedAt: new Date(),
  })

  await add('bean-cafe', { category: cafes, name: 'Bean Cafe' })
  await add('leaf-cafe', { category: cafes, name: 'Leaf Cafe' })

  for (const n of [1, 2, 3, 4, 5]) {
    await add(`fixit-${n}`, { category: plumbers, name: `Fixit Pipes ${n}`, areaId: thamel.id })
  }

  await db.searchSynonym.create({ data: { term: 'plumber', synonyms: ['dhara mistri'] } })

  await syncListings()
  await refreshCategoryCounts()

  return {
    categories: { eat, home, restaurants, cafes, plumbers },
    areas: { thamel, patan },
    tags: { vegetarian, rooftop },
    listings,
  }
}

/** The visible restaurants (LIVE, not deleted): 9 listings. */
export const LIVE_RESTAURANTS = [
  'pizza-palace',
  'momo-house',
  'newari-kitchen',
  'thakali-bhanchha',
  'dal-bhat-corner',
  'food-app',
  'featured-one',
  'featured-two',
  'featured-three',
]
