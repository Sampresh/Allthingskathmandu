import { db } from '../../src/config/db.js'
import { Prisma } from '../../src/generated/prisma/client'

const KEEP = ['_prisma_migrations', 'spatial_ref_sys']

/** Empties every application table in the test database. */
export async function resetDb() {
  const rows = await db.$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> ALL(${KEEP})`
  const tables = rows.map((r) => `"public"."${r.tablename}"`).join(', ')
  await db.$executeRaw`TRUNCATE TABLE ${Prisma.raw(tables)} RESTART IDENTITY CASCADE`
}

let counter = 0

/** Creates a listing with sensible defaults; override any field. */
export function createListing(data = {}) {
  counter += 1
  return db.business.create({
    data: {
      slug: `listing-${counter}-${Date.now()}`,
      name: `Listing ${counter}`,
      shortDesc: 'Test listing',
      status: 'LIVE',
      ...data,
    },
  })
}
