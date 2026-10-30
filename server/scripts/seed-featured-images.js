// Dev-only helper: give a slice of the imported listings a Featured window + a themed cover
// photo (and a logo), so the home rows and admin screens show real imagery instead of the
// monogram fallback. Photos are free Unsplash stock, themed by the listing's top-level group
// (each image's subject was checked by eye, so labels and pictures match).
//
//   npm run seed:images                 # top 3 listings per category, skips ones already done
//   PER_CATEGORY=2 npm run seed:images
//   OVERWRITE=1 npm run seed:images     # also realign the cover/logo of already-featured rows
//
// Not for production: production photos are Cloudinary uploads gated by the Featured plan.
import { db } from '../src/config/db.js'
import { env } from '../src/config/env.js'

const PER_CATEGORY = Math.max(1, Number(process.env.PER_CATEGORY) || 3)
const OVERWRITE = ['1', 'true', 'yes'].includes(String(process.env.OVERWRITE).toLowerCase())
const FEATURED_DAYS = 60
const U = (id) => `https://images.unsplash.com/photo-${id}`

// One confirmed-subject cover per top-level group.
const GROUP_COVER = {
  'eat-and-drink': U('1517248135467-4c7edcad34c4'), // restaurant interior
  'get-around': U('1502877338535-766e1452684a'), // car
  stay: U('1566073771259-6a8506099945'), // lodge and pool
  essentials: U('1556742049-0cfed4f6a45d'), // shop
  'health-and-wellness': U('1519494026892-80bbd2d6fd0d'), // hospital reception
  shopping: U('1441986300917-64674bd600d8'), // boutique
  'things-to-do': U('1519125323398-675f0ddb6308'), // mountain viewpoint
  'home-services': U('1504148455328-c376907d081c'), // power drill
  'services-and-events': U('1497366216548-37526070297c'), // office
  emergency: U('1587745416684-47953f16f02f'), // ambulance
}

const coverFor = (groupSlug) => GROUP_COVER[groupSlug] ?? GROUP_COVER['services-and-events']

async function main() {
  if (env.isProduction) throw new Error('seed:images is for local/dev data only')
  console.log(`Seeding Featured photos (${PER_CATEGORY} per category${OVERWRITE ? ', overwrite' : ''})`)

  // category id -> parent group slug
  const categories = await db.category.findMany({
    where: { kind: 'DIRECTORY' },
    select: { id: true, parent: { select: { slug: true } } },
  })
  const groupOf = new Map(categories.map((c) => [c.id, c.parent?.slug ?? null]))

  // LIVE, non-hotline listings with their primary category, best first per category.
  const listings = await db.business.findMany({
    where: { status: 'LIVE', type: { not: 'HOTLINE' }, deletedAt: null },
    select: {
      id: true,
      name: true,
      logoUrl: true,
      featuredUntil: true,
      categories: { where: { isPrimary: true }, select: { categoryId: true } },
      media: { where: { type: 'PHOTO' }, orderBy: { sortOrder: 'asc' }, select: { id: true } },
    },
    orderBy: [{ ratingAvg: 'desc' }, { ratingCount: 'desc' }, { id: 'asc' }],
  })

  const takenByCategory = new Map()
  const featuredUntil = new Date(Date.now() + FEATURED_DAYS * 24 * 60 * 60 * 1000)
  let featured = 0
  let photos = 0
  let logos = 0

  for (const listing of listings) {
    const categoryId = listing.categories[0]?.categoryId
    if (!categoryId) continue
    const count = takenByCategory.get(categoryId) ?? 0
    if (count >= PER_CATEGORY) continue
    takenByCategory.set(categoryId, count + 1)

    const cover = coverFor(groupOf.get(categoryId))
    const data = {}
    if (!listing.featuredUntil || listing.featuredUntil <= new Date()) {
      data.featuredUntil = featuredUntil
      data.isVerified = true
      featured += 1
    }
    if (!listing.logoUrl || OVERWRITE) {
      data.logoUrl = cover
      logos += 1
    }
    if (Object.keys(data).length) {
      await db.business.update({ where: { id: listing.id }, data })
    }

    const existing = listing.media[0]
    if (!existing) {
      await db.media.create({
        data: { businessId: listing.id, type: 'PHOTO', url: cover, altText: listing.name, sortOrder: 0 },
      })
      photos += 1
    } else if (OVERWRITE) {
      await db.media.update({ where: { id: existing.id }, data: { url: cover, altText: listing.name } })
      photos += 1
    }
  }

  console.log(`  featured: ${featured}, photos: ${photos}, logos: ${logos}`)
  console.log('Done. Purge the home/listing cache (or restart) for changes to show.')
}

main()
  .catch((err) => {
    console.error(`seed:images failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(() => db.$disconnect())
