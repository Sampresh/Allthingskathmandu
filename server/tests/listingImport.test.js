import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { createSession } from '../src/services/token.js'
import { planImport, resultCsv, runImport } from '../src/services/listingImport.js'
import { syncAreas, syncTaxonomy } from '../src/services/taxonomySync.js'
import { createUser, flushRedis } from './helpers/auth.js'
import { resetDb } from './helpers/db.js'

const app = createApp()
const csv = readFileSync('prisma/data/listings.csv', 'utf8')
const HEADER = 'category,type,name,address,phone,hours,website,desc,g_rating,g_reviews,place_id'

async function adminToken(role = 'ADMIN') {
  const user = await createUser({ role, totpEnabled: true })
  const { accessToken } = await createSession(user, { mfa: true })
  return { user, token: accessToken }
}

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  await syncAreas(db)
})

describe('listings import: provided file', () => {
  it('dry run: 328 rows, 0 errors, nothing written', async () => {
    const { counts, rows } = await planImport(csv)
    expect(counts).toMatchObject({ total: 328, create: 328, update: 0, skip: 0, error: 0 })
    expect(counts.hoursToReview).toBe(1)
    expect(rows.find((r) => r.name === 'Jasper Restaurant')).toMatchObject({
      action: 'create',
      slug: 'jasper-restaurant',
      area: 'Thamel',
      category: 'Restaurants',
    })
    expect(await db.business.count()).toBe(0)
    expect(await db.category.count()).toBe(0)
  })

  it('imports every row as PENDING and unverified, then re-runs without duplicates', async () => {
    const first = await runImport({ csv })
    expect(first.counts).toMatchObject({ total: 328, create: 328, error: 0 })
    expect(await db.business.count()).toBe(328)
    expect(await db.business.count({ where: { status: 'PENDING', isVerified: false } })).toBe(328)
    expect(await db.business.count({ where: { ownerId: { not: null } } })).toBe(0)
    expect(await db.auditLog.count({ where: { action: 'business.import_create' } })).toBe(328)

    const jasper = await db.business.findFirst({
      where: { name: 'Jasper Restaurant' },
      include: { categories: { include: { category: true } }, area: true },
    })
    expect(jasper).toMatchObject({
      googlePlaceId: 'ChIJD3hJz3kZ6zkRWXOu725x47Q',
      phone: '+9779803050739',
      shortDesc: '',
      verification: {
        phone: false,
        hours: false,
        location: false,
        logo: false,
        description: false,
      },
    })
    expect(jasper.hours.fri).toEqual([['10:00', '01:00']])
    expect(jasper.area.slug).toBe('thamel')
    expect(jasper.categories).toMatchObject([
      { isPrimary: true, category: { slug: 'restaurants' } },
    ])
    // Google ratings are never stored: no column holds them.
    expect(JSON.stringify(jasper)).not.toContain('4761')

    const foodmandu = await db.business.findFirst({ where: { name: 'Foodmandu' } })
    expect(foodmandu).toMatchObject({
      type: 'APP',
      website: 'https://foodmandu.com',
      shortDesc: 'Food delivery from 1,000+ restaurants; OneMart grocery delivery in the same app',
      areaId: null,
    })
    const police = await db.business.findFirst({ where: { name: 'Police' } })
    expect(police).toMatchObject({ type: 'HOTLINE', phone: '100' })
    const tu = await db.business.findFirst({ where: { name: 'T.U. Teaching Hospital' } })
    expect(tu.hours).toBeNull()
    expect(tu.adminNote).toBe('Hours from import: OPD Mon-Fri 08:00-17:00; ER unconfirmed')

    // Rows ranked within a category are created (and so ordered by id) in file order.
    const restaurants = await db.business.findMany({
      where: { categories: { some: { category: { slug: 'restaurants' } } } },
      orderBy: { id: 'asc' },
      select: { name: true },
    })
    expect(restaurants.slice(0, 2).map((r) => r.name)).toEqual([
      'Thirsty Newari Restaurant',
      'Green Villy Restaurant',
    ])
    // Groups and categories from the taxonomy were created once.
    expect(await db.category.count({ where: { parentId: null } })).toBe(10)
    expect(await db.category.count({ where: { parentId: { not: null } } })).toBe(59)

    const again = await runImport({ csv })
    expect(again.counts).toMatchObject({ create: 0, update: 0, skip: 328, error: 0 })
    expect(await db.business.count()).toBe(328)
  })
})

describe('listings import: matching and row checks', () => {
  beforeEach(() => syncTaxonomy(db))

  it('updates by place id or name + category, filling in without clearing', async () => {
    await runImport({
      csv: [
        HEADER,
        'Cafes,BUSINESS,Five10 Cafe,"Thabahi Sadak, Thamel",,08:00-21:00,,,4.9,177,ChIJByvwWoAZ6zkR5zBU344MF-4',
        'Ride Apps,APP,Pathao,,,,,Rides,,,',
      ].join('\n'),
    })
    const { counts, rows } = await planImport(
      [
        HEADER,
        // Same place id, new name and phone; empty hours leave the old ones.
        'Cafes,BUSINESS,Five 10 Cafe,,+9779851417282,,,,4.9,177,ChIJByvwWoAZ6zkR5zBU344MF-4',
        // Same name and category, any case.
        'Ride Apps,APP,PATHAO,,,,pathao.com,Rides,,,',
      ].join('\n'),
    )
    expect(counts).toMatchObject({ update: 2, error: 0 })
    expect(rows[0].messages).toEqual(['Updates name, phone'])
    expect(rows[1].messages).toEqual(['Updates name, website'])
  })

  it('reports bad rows by line and keeps slugs unique', async () => {
    const { counts, rows } = await planImport(
      [
        HEADER,
        'Nowhere,BUSINESS,Ghost,,,,,,,,',
        'Cafes,SHOP,Odd Type,,,,,,,,',
        'Cafes,BUSINESS,Short Code Cafe,Thamel,100,,,,,,',
        `Ride Apps,APP,Long,,,,,${'x'.repeat(121)},,,`,
        'Cafes,BUSINESS,Twin Cafe,"Jyatha, Kathmandu",,,,,,,',
        'Bakeries,BUSINESS,Twin Cafe,Kathmandu,,,,,,,',
        'Cafes,BUSINESS,Twin Cafe,Kathmandu,,,,,,,',
      ].join('\n'),
    )
    expect(counts).toMatchObject({ total: 7, create: 2, error: 5 })
    expect(rows.slice(0, 4).map((r) => [r.line, r.messages[0]])).toEqual([
      [2, 'Unknown category "Nowhere"'],
      [3, 'Unknown type "SHOP"'],
      [4, 'Phone "100" is a short code; only hotlines may use one'],
      [5, 'desc is 121 characters (max 120)'],
    ])
    expect(rows[4]).toMatchObject({ slug: 'twin-cafe', area: 'Thamel', flags: [] })
    expect(rows[5]).toMatchObject({ slug: 'twin-cafe-2', flags: ['needs area'] })
    expect(rows[6].messages).toEqual(['Same listing as line 6'])
    expect(resultCsv(rows).split('\r\n')[0]).toBe(
      'line,action,name,slug,id,category,area,flags,messages',
    )
  })
})

describe('POST /admin/listings/import', () => {
  it('dry runs inline, queues real runs, and is for admins only', async () => {
    const admin = await adminToken()
    const dry = await request(app)
      .post('/api/v1/admin/listings/import')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ csv, dryRun: true })
    expect(dry.status).toBe(200)
    expect(dry.body.data.counts).toMatchObject({ total: 328, error: 0 })

    const queued = await request(app)
      .post('/api/v1/admin/listings/import')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ csv })
    expect(queued.status).toBe(201)
    const job = await getQueue(QUEUE.IMPORT).getJob(queued.body.data.jobId)
    expect(job.opts.attempts).toBe(1)

    const bad = await request(app)
      .post('/api/v1/admin/listings/import')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ csv: 'name,slug\nA,a' })
    expect(bad.status).toBe(400)
    expect(bad.body.error.message).toBe('Missing columns: category, type')

    const mod = await adminToken('MODERATOR')
    const denied = await request(app)
      .post('/api/v1/admin/listings/import')
      .set('Authorization', `Bearer ${mod.token}`)
      .send({ csv, dryRun: true })
    expect(denied.status).toBe(403)
  })
})
