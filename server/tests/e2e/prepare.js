/**
 * Prepares the end-to-end database (client/playwright.config.js runs this before the API
 * starts): migrate, empty, seed, import prisma/data/listings.csv, then publish a small demo
 * set so public pages have something to show, and create one user per role.
 *
 * Refuses to touch any database other than atk_e2e or any Redis other than db 2: the demo
 * data (pins at area centres, generated one-liners, all items ticked as verified) is test
 * data and must never reach a real database.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { parse } from 'csv-parse/sync'
import { db } from '../../src/config/db.js'
import { redis } from '../../src/config/redis.js'
import { closeQueues } from '../../src/jobs/queues.js'
import { slugify } from '../../src/lib/slug.js'
import { setBusinessLocation } from '../../src/services/geo.js'
import { runImport } from '../../src/services/listingImport.js'
import { refreshCategoryCounts, syncListings } from '../../src/services/listingSync.js'
import { refreshProfileScore } from '../../src/services/listings.js'
import { resetDb } from '../helpers/db.js'

export const E2E_USERS = {
  ADMIN: { email: 'e2e-admin@atk.test', name: 'E2E Admin' },
  MODERATOR: { email: 'e2e-mod@atk.test', name: 'E2E Moderator' },
  MEMBER: { email: 'e2e-member@atk.test', name: 'E2E Member' },
}
// Throwaway test password for the e2e database only (also in client/e2e/helpers.js).
const PASSWORD = 'E2e-Test-Passw0rd!'

// Categories published for the demo, and how many listings of each.
const DEMO = {
  // One restaurant stays PENDING, so tests can check unpublished listings stay hidden.
  restaurants: 8,
  cafes: 7,
  'bars-and-nightlife': 6,
  'ride-apps': 5,
  'food-delivery-apps': 4,
  hotlines: 6,
  '24h-hospitals': 8,
}
// Cloudinary's public demo image stands in for app logos (apps need one to publish).
const SAMPLE_LOGO = 'https://res.cloudinary.com/demo/image/upload/sample.jpg'
const DAY_MS = 86_400_000

function assertE2eTargets() {
  if (!/\/atk_e2e(\?|$)/.test(process.env.DATABASE_URL ?? ''))
    throw new Error('prepare.js only runs against the atk_e2e database')
  if (!/\/2$/.test(process.env.REDIS_URL ?? ''))
    throw new Error('prepare.js only runs against Redis db 2')
}

async function publishDemo(csvRows) {
  const thamel = await db.area.findUnique({ where: { slug: 'thamel' } })
  const centres = new Map(
    (
      await db.$queryRaw`SELECT id, ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng FROM areas`
    ).map((a) => [a.id, a]),
  )
  let published = 0
  for (const [slug, count] of Object.entries(DEMO)) {
    const category = await db.category.findUnique({ where: { slug } })
    // The first `count` rows of the category in file order (ids made in the same millisecond
    // need not sort in file order, so names decide).
    const names = csvRows.filter((r) => slugify(r.category) === slug).map((r) => r.name)
    const found = await db.business.findMany({
      where: {
        name: { in: names },
        categories: { some: { categoryId: category.id, isPrimary: true } },
      },
      include: { area: true },
    })
    const listings = names
      .map((n) => found.find((l) => l.name === n))
      .filter(Boolean)
      .slice(0, count)
    for (const [i, listing] of listings.entries()) {
      const placed = !['APP', 'HOTLINE'].includes(listing.type)
      const areaId = placed ? (listing.areaId ?? thamel.id) : null
      const areaName = listing.area?.nameEn ?? 'Thamel'
      await db.business.update({
        where: { id: listing.id },
        data: {
          status: 'LIVE',
          areaId,
          shortDesc:
            listing.shortDesc ||
            (listing.type === 'HOTLINE'
              ? `${listing.name} emergency line, free to call`
              : `${category.nameEn.replace(/s$/, '')} in ${areaName}`),
          verification: { phone: true, hours: true, location: true, logo: true, description: true },
          isVerified: i % 3 === 0,
          ...(listing.type === 'APP' && {
            logoUrl: SAMPLE_LOGO,
            website: listing.website ?? `https://${listing.slug}.example.com`,
          }),
          ...(slug === 'restaurants' &&
            i < 2 && { featuredUntil: new Date(Date.now() + 30 * DAY_MS) }),
        },
      })
      if (placed) {
        // Spread pins around the area centre so the map shows separate markers.
        const c = centres.get(areaId) ?? centres.get(thamel.id)
        const angle = (i / count) * 2 * Math.PI
        await setBusinessLocation(db, listing.id, {
          lat: c.lat + 0.004 * Math.sin(angle),
          lng: c.lng + 0.004 * Math.cos(angle),
        })
      }
      await refreshProfileScore(db, listing.id)
      published += 1
    }
  }
  await syncListings()
  await refreshCategoryCounts()
  return published
}

async function createUsers() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10)
  for (const [role, user] of Object.entries(E2E_USERS)) {
    await db.user.create({
      data: { ...user, role, passwordHash, emailVerifiedAt: new Date() },
    })
  }
}

async function main() {
  assertE2eTargets()
  const env = { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: '1' }
  execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'pipe', env })
  await resetDb()
  await redis.flushdb()
  execFileSync('node_modules/.bin/tsx', ['prisma/seed.js'], { stdio: 'pipe', env })
  const csv = readFileSync('prisma/data/listings.csv', 'utf8')
  const { counts } = await runImport({ csv })
  const published = await publishDemo(parse(csv, { columns: true, bom: true }))
  await createUsers()
  // The import queued jobs for a worker that has not started yet; the demo did that work.
  await redis.flushdb()
  console.log(`e2e: imported ${counts.create} listings, published ${published}`)
}

main()
  .catch((err) => {
    console.error(`e2e prepare failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeQueues()
    await db.$disconnect()
    redis.disconnect()
  })
