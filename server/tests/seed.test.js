import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { db } from '../src/config/db.js'
import { resetDb } from './helpers/db.js'

const runSeed = () =>
  execFileSync('node_modules/.bin/tsx', ['prisma/seed.js'], {
    stdio: 'pipe',
    env: { ...process.env, ADMIN_EMAIL: 'admin@atk.test', ADMIN_PASSWORD: 'Seed-Test-Passw0rd!' },
  }).toString()

const counts = async () => ({
  users: await db.user.count(),
  categories: await db.category.count(),
  areas: await db.area.count(),
  businesses: await db.business.count(),
  plans: await db.plan.count(),
  settings: await db.setting.count(),
  homeSections: await db.homeSection.count(),
  synonyms: await db.searchSynonym.count(),
})

describe('prisma/seed.js', () => {
  beforeAll(async () => {
    await resetDb()
    runSeed()
  })

  it('seeds the taxonomy, areas, plans, settings, home sections and synonyms', async () => {
    expect(await counts()).toEqual({
      users: 1,
      categories: 10 + 60 + 9,
      areas: 16,
      businesses: 53,
      plans: 2,
      settings: 3,
      homeSections: 7,
      synonyms: 3,
    })
  })

  it('is idempotent and keeps Admin edits', async () => {
    await db.category.update({ where: { slug: 'restaurants' }, data: { nameEn: 'Places to eat' } })
    const before = await counts()
    runSeed()
    expect(await counts()).toEqual(before)
    const edited = await db.category.findUnique({ where: { slug: 'restaurants' } })
    expect(edited.nameEn).toBe('Places to eat')
  })

  it('creates a verified super admin, every area centre and LIVE emergency numbers only', async () => {
    const admin = await db.user.findUnique({ where: { email: 'admin@atk.test' } })
    expect(admin).toMatchObject({ role: 'SUPER_ADMIN' })
    expect(admin.emailVerifiedAt).not.toBeNull()

    const [{ missing }] =
      await db.$queryRaw`SELECT count(*)::int AS missing FROM areas WHERE center IS NULL`
    expect(missing).toBe(0)

    const live = await db.business.findMany({ where: { status: 'LIVE' }, orderBy: { slug: 'asc' } })
    expect(live.map((b) => [b.slug, b.phone])).toEqual([
      ['ambulance-102', '102'],
      ['fire-101', '101'],
      ['police-100', '100'],
      ['tourist-police-1144', '1144'],
    ])
  })

  it('keeps FEATURED inactive until Admin sets a price, and market slugs prefixed', async () => {
    const featured = await db.plan.findUnique({ where: { code: 'FEATURED' } })
    expect(featured.isActive).toBe(false)
    const market = await db.category.findMany({ where: { kind: 'MARKET' } })
    expect(market.every((c) => c.slug.startsWith('market-'))).toBe(true)
  })
})
