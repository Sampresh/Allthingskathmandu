import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { createSession } from '../src/services/token.js'
import { createListing, resetDb } from './helpers/db.js'
import { createUser, flushRedis } from './helpers/auth.js'

const app = createApp()

async function tokenFor(role, extra = {}) {
  const user = await createUser({ role, totpEnabled: role !== 'MEMBER', ...extra })
  const { accessToken } = await createSession(user, { mfa: role !== 'MEMBER' })
  return { user, token: accessToken }
}

const call = (method, path, token, body) => {
  const req = request(app)[method](`/api/v1/admin${path}`)
  if (token) req.set('Authorization', `Bearer ${token}`)
  return body === undefined ? req : req.send(body)
}

const jobs = async (queue, name) =>
  (await getQueue(queue).getJobs(['waiting', 'delayed'])).filter((j) => !name || j.name === name)

const VERIFIED = { phone: true, hours: true, location: true, logo: true, description: true }

let admin
let group
let category
let other
let area

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  admin = await tokenFor('ADMIN')
  group = await db.category.create({ data: { slug: 'eat-and-drink', nameEn: 'Eat & Drink' } })
  category = await db.category.create({
    data: { slug: 'restaurants', nameEn: 'Restaurants', parentId: group.id },
  })
  other = await db.category.create({
    data: { slug: 'cafes', nameEn: 'Cafes', parentId: group.id },
  })
  area = await db.area.create({ data: { slug: 'thamel', nameEn: 'Thamel', district: 'Kathmandu' } })
})

// A listing that passes the BUSINESS publish rules.
const body = (extra = {}) => ({
  name: 'Momo Hut',
  type: 'BUSINESS',
  shortDesc: 'Steamed momo',
  categoryIds: [category.id],
  areaId: area.id,
  phone: '01-4000000',
  location: { lat: 27.7154, lng: 85.3123 },
  hours: { mon: [['10:00', '20:00']] },
  verification: VERIFIED,
  status: 'LIVE',
  ...extra,
})

const make = async (extra) => (await call('post', '/listings', admin.token, body(extra))).body.data

describe('permissions', () => {
  it('lets moderators read but not change; super admins alone delete for good', async () => {
    const listing = await make({ status: 'DRAFT' })
    const mod = await tokenFor('MODERATOR')
    expect((await call('get', '/listings', mod.token)).status).toBe(200)
    expect((await call('get', `/listings/${listing.id}`, mod.token)).status).toBe(200)
    expect((await call('get', `/listings/${listing.id}/history`, mod.token)).status).toBe(200)
    expect((await call('get', '/listings/export', mod.token)).status).toBe(200)
    for (const [method, path, payload] of [
      ['post', '/listings', body()],
      ['patch', `/listings/${listing.id}`, { name: 'X' }],
      ['post', `/listings/${listing.id}/status`, { status: 'LIVE' }],
      ['delete', `/listings/${listing.id}`],
      ['post', `/listings/${listing.id}/duplicate`],
      ['post', '/listings/bulk', { ids: [listing.id], action: 'verify' }],
      ['post', '/listings/import', { csv: 'a', dryRun: true }],
    ]) {
      expect((await call(method, path, mod.token, payload)).status, `${method} ${path}`).toBe(403)
    }

    const member = await tokenFor('MEMBER')
    expect((await call('get', '/listings', member.token)).status).toBe(403)

    await call('delete', `/listings/${listing.id}`, admin.token)
    const permanent = (token) =>
      call('delete', `/listings/${listing.id}/permanent`, token, { confirmName: 'Momo Hut' })
    expect((await permanent(admin.token)).status).toBe(403)
    const superAdmin = await tokenFor('SUPER_ADMIN')
    expect((await permanent(superAdmin.token)).status).toBe(200)
  })
})

describe('create and update', () => {
  it('creates with relations, audits, and queues purge, revalidation and search sync', async () => {
    const res = await call('post', '/listings', admin.token, body())
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      slug: 'momo-hut',
      status: 'LIVE',
      categoryIds: [category.id],
      location: { lat: expect.closeTo(27.7154, 4) },
      hours: { mon: [['10:00', '20:00']], tue: [] },
      verification: VERIFIED,
      publishProblems: [],
    })
    // 6 of the 11 BUSINESS fields (no description, logo, WhatsApp, website or address).
    expect(res.body.data.profileScore).toBe(55)
    expect((await call('post', '/listings', admin.token, body())).body.data.slug).toBe('momo-hut-2')

    const [log] = await db.auditLog.findMany({ where: { action: 'business.create' }, take: 1 })
    expect(log).toMatchObject({ actorId: admin.user.id, entity: 'business' })
    const purge = (await jobs(QUEUE.CACHE, 'purge'))[0]
    expect(purge.data.tags).toEqual(expect.arrayContaining(['home', `category:${category.id}`]))
    const revalidated = (await jobs(QUEUE.REVALIDATE)).flatMap((job) => job.data.tags)
    expect(revalidated).toEqual(
      expect.arrayContaining(['listing:momo-hut', 'category:restaurants']),
    )
    expect((await jobs(QUEUE.DIRECTORY, 'sync-listings')).length).toBeGreaterThan(0)
  })

  it('rejects bad input, including short codes on non-hotlines', async () => {
    const bad = await call('post', '/listings', admin.token, {
      ...body(),
      logoUrl: 'https://evil.example/logo.png',
      website: 'javascript:alert(1)',
      hours: { mon: [['10:00', '10:00']] },
      categoryIds: [],
    })
    expect(bad.status).toBe(400)
    expect(bad.body.error.details.map((d) => d.path)).toEqual(
      expect.arrayContaining(['logoUrl', 'website', 'categoryIds']),
    )

    const listing = await make({ status: 'DRAFT' })
    const shortCode = await call('patch', `/listings/${listing.id}`, admin.token, { phone: '100' })
    expect(shortCode.status).toBe(400)
    expect(shortCode.body.error.details[0].path).toBe('phone')
    const hotline = await call('patch', `/listings/${listing.id}`, admin.token, {
      type: 'HOTLINE',
      phone: '100',
    })
    expect(hotline.status).toBe(200)
  })

  it('updates with the old slug revalidated and recomputes profileScore', async () => {
    const data = await make()
    await flushRedis()
    const updated = await call('patch', `/listings/${data.id}`, admin.token, {
      slug: 'momo-hut-thamel',
      description: 'Family-run since 1998',
      adminNote: 'Owner prefers WhatsApp',
    })
    expect(updated.body.data).toMatchObject({
      slug: 'momo-hut-thamel',
      adminNote: 'Owner prefers WhatsApp',
      profileScore: 64,
    })
    const tags = (await jobs(QUEUE.REVALIDATE))[0].data.tags
    expect(tags).toEqual(
      expect.arrayContaining(['listing:momo-hut', 'listing:momo-hut-thamel', `listing:${data.id}`]),
    )
    const [log] = await db.auditLog.findMany({ where: { action: 'business.update' } })
    expect(log.diff.slug).toEqual({ from: 'momo-hut', to: 'momo-hut-thamel' })
  })
})

describe('publish rules', () => {
  it('blocks LIVE with a 422 listing what is missing, by type', async () => {
    const res = await call('post', '/listings', admin.token, {
      ...body(),
      areaId: null,
      location: null,
      verification: { phone: true },
    })
    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('PUBLISH_BLOCKED')
    expect(res.body.error.details.map((d) => d.path)).toEqual([
      'areaId',
      'location',
      'verification.hours',
    ])
    expect(await db.business.count()).toBe(0)

    const app = await make({
      type: 'APP',
      status: 'DRAFT',
      phone: null,
      hours: null,
      areaId: null,
      location: null,
    })
    const blocked = await call('post', `/listings/${app.id}/status`, admin.token, {
      status: 'LIVE',
    })
    expect(blocked.status).toBe(422)
    expect(blocked.body.error.details.map((d) => d.path)).toEqual(['logoUrl', 'website'])
    await call('patch', `/listings/${app.id}`, admin.token, {
      playStoreUrl: 'https://play.google.com/store/apps/details?id=np.pathao',
      logoUrl: 'https://res.cloudinary.com/atk/image/upload/v1/logo.png',
    })
    expect(
      (await call('post', `/listings/${app.id}/status`, admin.token, { status: 'LIVE' })).status,
    ).toBe(200)

    const hotline = await make({ type: 'HOTLINE', phone: null, status: 'DRAFT' })
    expect(
      (await call('post', `/listings/${hotline.id}/status`, admin.token, { status: 'LIVE' }))
        .status,
    ).toBe(422)
  })

  it('keeps a LIVE listing valid: an edit that breaks the rules is refused', async () => {
    const listing = await make()
    const res = await call('patch', `/listings/${listing.id}`, admin.token, { location: null })
    expect(res.status).toBe(422)
    expect((await call('get', `/listings/${listing.id}`, admin.token)).body.data.location).not.toBe(
      null,
    )
    // A suspended listing may be edited freely.
    await call('post', `/listings/${listing.id}/status`, admin.token, { status: 'SUSPENDED' })
    expect(
      (await call('patch', `/listings/${listing.id}`, admin.token, { location: null })).status,
    ).toBe(200)
  })
})

describe('Trash', () => {
  it('soft deletes to Trash, restores, and deletes for good from Trash only', async () => {
    const listing = await make()
    expect((await call('delete', `/listings/${listing.id}`, admin.token)).status).toBe(200)
    expect((await db.business.findUnique({ where: { id: listing.id } })).deletedAt).not.toBeNull()
    // Still readable for Admin, but not editable until restored.
    expect((await call('get', `/listings/${listing.id}`, admin.token)).status).toBe(200)
    expect(
      (await call('patch', `/listings/${listing.id}`, admin.token, { name: 'X' })).status,
    ).toBe(409)
    const trash = await call('get', '/listings?status=TRASH', admin.token)
    expect(trash.body.data.map((l) => l.id)).toEqual([listing.id])
    expect(trash.body.meta.counts).toMatchObject({ ALL: 0, LIVE: 0, TRASH: 1 })

    const restored = await call('post', `/listings/${listing.id}/restore`, admin.token)
    expect(restored.body.data).toMatchObject({ deletedAt: null, status: 'LIVE' })
    const revalidated = (await jobs(QUEUE.REVALIDATE)).flatMap((job) => job.data.tags)
    expect(revalidated).toContain('listing:momo-hut')

    const superAdmin = await tokenFor('SUPER_ADMIN')
    const tooSoon = await call('delete', `/listings/${listing.id}/permanent`, superAdmin.token, {
      confirmName: 'Momo Hut',
    })
    expect(tooSoon.status).toBe(409)
    await call('delete', `/listings/${listing.id}`, admin.token)
    await db.media.create({
      data: {
        businessId: listing.id,
        type: 'PHOTO',
        url: 'https://res.cloudinary.com/atk/image/upload/v1/p.jpg',
        publicId: 'atk-test/listings/p',
        altText: 'Dining room',
      },
    })
    const wrongName = await call('delete', `/listings/${listing.id}/permanent`, superAdmin.token, {
      confirmName: 'Momo',
    })
    expect(wrongName.status).toBe(400)
    const gone = await call('delete', `/listings/${listing.id}/permanent`, superAdmin.token, {
      confirmName: 'momo hut',
    })
    expect(gone.body.data).toEqual({ deleted: true, assetsQueued: 1 })
    expect(await db.business.findUnique({ where: { id: listing.id } })).toBeNull()
    expect((await jobs(QUEUE.MEDIA, 'delete')).map((j) => j.data.publicId)).toEqual([
      'atk-test/listings/p',
    ])
    expect(await db.auditLog.count({ where: { action: 'business.delete_permanent' } })).toBe(1)
  })
})

describe('table', () => {
  it('filters, counts tabs, sorts and pages with a keyset cursor', async () => {
    const momo = await make()
    await make({ name: 'Pizza Place', status: 'DRAFT', categoryIds: [other.id], areaId: null })
    await make({ name: 'Apple Cafe', status: 'DRAFT', phone: null, verification: null })
    await createListing({ name: 'Old', status: 'PENDING', deletedAt: new Date() })

    const all = await call('get', '/listings?sort=name', admin.token)
    expect(all.body.data.map((l) => l.name)).toEqual(['Apple Cafe', 'Momo Hut', 'Pizza Place'])
    expect(all.body.meta.counts).toEqual({
      ALL: 3,
      PENDING: 0,
      LIVE: 1,
      SUSPENDED: 0,
      DRAFT: 2,
      TRASH: 1,
    })
    const live = await call('get', '/listings?status=LIVE', admin.token)
    expect(live.body.data.map((l) => l.name)).toEqual(['Momo Hut'])
    expect(live.body.data[0]).toMatchObject({
      category: { id: category.id, nameEn: 'Restaurants', groupNameEn: 'Eat & Drink' },
      area: { id: area.id, nameEn: 'Thamel' },
      missing: ['logo'],
      publishProblems: [],
    })

    const q = (query) =>
      call('get', `/listings?${query}`, admin.token).then((r) => r.body.data.map((l) => l.name))
    expect(await q('q=pizza')).toEqual(['Pizza Place'])
    expect(await q(`category=${other.id}`)).toEqual(['Pizza Place'])
    expect(await q(`group=${group.id}&sort=name`)).toEqual([
      'Apple Cafe',
      'Momo Hut',
      'Pizza Place',
    ])
    expect(await q('area=none')).toEqual(['Pizza Place'])
    expect(await q('missing=phone')).toEqual(['Apple Cafe'])
    expect(await q('missing=phone,area')).toEqual([])
    expect(await q('hasOwner=false&verified=false&sort=name&dir=desc')).toEqual([
      'Pizza Place',
      'Momo Hut',
      'Apple Cafe',
    ])

    // Both Thamel listings (ties in creation order), then the one with no area.
    const first = await call('get', '/listings?sort=area&limit=2', admin.token)
    expect(first.body.data.map((l) => l.name)).toEqual(['Momo Hut', 'Apple Cafe'])
    const second = await call(
      'get',
      `/listings?sort=area&limit=2&cursor=${first.body.meta.nextCursor}`,
      admin.token,
    )
    expect(second.body.data.map((l) => l.name)).toEqual(['Pizza Place'])
    expect(second.body.meta.nextCursor).toBeNull()

    const byDate = await call('get', '/listings?limit=1', admin.token)
    const next = await call(
      'get',
      `/listings?limit=5&cursor=${byDate.body.meta.nextCursor}`,
      admin.token,
    )
    expect([...byDate.body.data, ...next.body.data].map((l) => l.id)).toHaveLength(3)
    expect(next.body.data.map((l) => l.id)).not.toContain(byDate.body.data[0].id)
    expect(momo.id).toBeDefined()
  })

  it('exports the current filter as CSV without Google fields', async () => {
    await make({ googlePlaceId: 'ChIJxWRuIwAZ6zkR2HxAVMxW6QE', name: 'Momo, "the" Hut' })
    await make({ name: 'Pizza Place', status: 'DRAFT' })
    const res = await call('get', '/listings/export?status=LIVE', admin.token)
    expect(res.headers['content-type']).toContain('text/csv')
    const [header, row, end] = res.text.split('\r\n')
    expect(header.split(',')).toContain('category')
    expect(header).not.toMatch(/google|place/i)
    expect(row).toContain('"Momo, ""the"" Hut"')
    expect(res.text).not.toContain('ChIJ')
    expect(end).toBe('')
  })
})

describe('bulk actions', () => {
  it('publishes what passes the rules and reports the rest', async () => {
    const ready = await make({ status: 'PENDING' })
    const notReady = await make({ name: 'No Pin', status: 'PENDING', location: null })
    const res = await call('post', '/listings/bulk', admin.token, {
      ids: [ready.id, notReady.id],
      action: 'publish',
    })
    expect(res.body.data.done).toEqual([ready.id])
    expect(res.body.data.failed).toEqual([
      { id: notReady.id, name: 'No Pin', message: 'Not ready to publish: pin the map location' },
    ])
    expect((await db.business.findUnique({ where: { id: ready.id } })).status).toBe('LIVE')
    expect(await db.auditLog.count({ where: { action: 'business.bulk_publish' } })).toBe(1)
  })

  it('verifies, suspends, unpublishes, deletes and restores', async () => {
    const a = await make()
    const b = await make({ name: 'Second' })
    const ids = [a.id, b.id]
    const run = (action, extra) =>
      call('post', '/listings/bulk', admin.token, { ids, action, ...extra }).then(
        (r) => r.body.data,
      )
    const rows = () => db.business.findMany({ where: { id: { in: ids } } })

    expect((await run('verify')).done).toHaveLength(2)
    expect((await rows()).every((l) => l.isVerified)).toBe(true)
    await run('suspend')
    expect((await rows()).every((l) => l.status === 'SUSPENDED')).toBe(true)
    await run('unpublish')
    expect((await rows()).every((l) => l.status === 'DRAFT')).toBe(true)
    await run('delete')
    expect((await rows()).every((l) => l.deletedAt)).toBe(true)
    expect((await run('verify')).failed.map((f) => f.message)).toEqual([
      'Not found or in Trash',
      'Not found or in Trash',
    ])
    expect((await run('restore')).done).toHaveLength(2)
    expect((await rows()).every((l) => !l.deletedAt)).toBe(true)
  })

  it('sets category, area and Featured', async () => {
    const a = await make()
    const ids = [a.id]
    const run = (action, extra) =>
      call('post', '/listings/bulk', admin.token, { ids, action, ...extra })

    expect((await run('set-category')).status).toBe(400)
    await run('set-category', { categoryId: other.id })
    const cats = await db.businessCategory.findMany({ where: { businessId: a.id } })
    expect(cats).toEqual([{ businessId: a.id, categoryId: other.id, isPrimary: true }])

    await run('set-area', { areaId: null })
    expect((await db.business.findUnique({ where: { id: a.id } })).areaId).toBeNull()

    await run('feature')
    const featured = await db.business.findUnique({ where: { id: a.id } })
    const days = (featured.featuredUntil - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    await run('feature', { featuredUntil: '2027-01-01T00:00:00.000Z' })
    expect(
      (await db.business.findUnique({ where: { id: a.id } })).featuredUntil.toISOString(),
    ).toBe('2027-01-01T00:00:00.000Z')
    await run('unfeature')
    expect((await db.business.findUnique({ where: { id: a.id } })).featuredUntil).toBeNull()
  })
})

describe('duplicate, history, owner', () => {
  it('duplicates as a DRAFT without owner, place id or media', async () => {
    const owner = await createUser({ role: 'BUSINESS_OWNER' })
    const source = await make({ googlePlaceId: 'ChIJxWRuIwAZ6zkR2HxAVMxW6QE' })
    await db.business.update({ where: { id: source.id }, data: { ownerId: owner.id } })
    const res = await call('post', `/listings/${source.id}/duplicate`, admin.token)
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      name: 'Momo Hut (copy)',
      slug: 'momo-hut-copy',
      status: 'DRAFT',
      ownerId: null,
      googlePlaceId: null,
      categoryIds: [category.id],
      location: { lat: expect.closeTo(27.7154, 4) },
      verification: { phone: false, hours: false },
    })

    const history = await call('get', `/listings/${res.body.data.id}/history`, admin.token)
    expect(history.body.data.map((h) => h.action)).toEqual(['business.duplicate'])
    const sourceHistory = await call('get', `/listings/${source.id}/history`, admin.token)
    // The source's history also shows the copy being made from it.
    expect(sourceHistory.body.data.map((h) => h.action)).toEqual([
      'business.duplicate',
      'business.create',
    ])
    expect(sourceHistory.body.data[1].actor.email).toBe(admin.user.email)
  })

  it('assigns an owner, making a member a business owner', async () => {
    const listing = await createListing()
    const member = await createUser()
    const res = await call('post', `/listings/${listing.id}/assign-owner`, admin.token, {
      email: member.email,
    })
    expect(res.body.data.owner.id).toBe(member.id)
    expect((await db.user.findUnique({ where: { id: member.id } })).role).toBe('BUSINESS_OWNER')
    const mod = await createUser({ role: 'MODERATOR' })
    expect(
      (await call('post', `/listings/${listing.id}/assign-owner`, admin.token, { userId: mod.id }))
        .status,
    ).toBe(400)
  })

  it('allows gallery uploads only while Featured', async () => {
    const listing = await make()
    const video = { type: 'VIDEO', url: 'https://youtu.be/dQw4w9WgXcQ', altText: 'Kitchen tour' }
    const refused = await call('post', `/listings/${listing.id}/media`, admin.token, video)
    expect(refused.body.error.code).toBe('FEATURED_REQUIRED')
    await call('patch', `/listings/${listing.id}`, admin.token, {
      featuredUntil: new Date(Date.now() + 86_400_000).toISOString(),
    })
    const added = await call('post', `/listings/${listing.id}/media`, admin.token, video)
    expect(added.status).toBe(201)
    const renamed = await call(
      'patch',
      `/listings/${listing.id}/media/${added.body.data.id}`,
      admin.token,
      { altText: 'Our kitchen' },
    )
    expect(renamed.body.data.altText).toBe('Our kitchen')
    expect(
      (await call('delete', `/listings/${listing.id}/media/${added.body.data.id}`, admin.token))
        .status,
    ).toBe(200)
  })
})
