import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { createSession } from '../src/services/token.js'
import { importListings } from '../src/services/listingImport.js'
import { resetDb, createListing } from './helpers/db.js'
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

let admin
let category
let area

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  admin = await tokenFor('ADMIN')
  const group = await db.category.create({ data: { slug: 'eat-and-drink', nameEn: 'Eat & Drink' } })
  category = await db.category.create({
    data: { slug: 'restaurants', nameEn: 'Restaurants', parentId: group.id },
  })
  area = await db.area.create({ data: { slug: 'thamel', nameEn: 'Thamel', district: 'Kathmandu' } })
})

describe('access', () => {
  it('requires staff with 2FA and narrows areas by role', async () => {
    expect((await call('get', '/listings')).status).toBe(401)
    const member = await tokenFor('MEMBER')
    expect((await call('get', '/claims', member.token)).status).toBe(403)

    const mod = await tokenFor('MODERATOR')
    expect((await call('get', '/claims', mod.token)).status).toBe(200)
    expect((await call('get', '/reviews', mod.token)).status).toBe(200)
    expect((await call('get', '/reports', mod.token)).status).toBe(200)
    expect((await call('get', '/listings', mod.token)).status).toBe(403)
    expect((await call('get', '/categories', mod.token)).status).toBe(403)

    expect((await call('get', '/listings', admin.token)).status).toBe(200)
    expect((await call('get', '/audit', admin.token)).status).toBe(403)

    const superAdmin = await tokenFor('SUPER_ADMIN')
    expect((await call('get', '/audit', superAdmin.token)).status).toBe(200)

    const noMfa = await createUser({ role: 'ADMIN', totpEnabled: true })
    const { accessToken } = await createSession(noMfa, { mfa: false })
    expect((await call('get', '/listings', accessToken)).body.error.code).toBe(
      'TWO_FACTOR_REQUIRED',
    )
  })
})

describe('listings', () => {
  const body = () => ({
    name: 'Momo Hut',
    type: 'BUSINESS',
    shortDesc: 'Steamed momo',
    categoryIds: [category.id],
    areaId: area.id,
    phone: '01-4000000',
    location: { lat: 27.7154, lng: 85.3123 },
    hours: { mon: [['10:00', '20:00']] },
    status: 'LIVE',
  })

  it('creates with relations, audits, and queues purge, revalidation and search sync', async () => {
    const res = await call('post', '/listings', admin.token, body())
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({
      slug: 'momo-hut',
      categoryIds: [category.id],
      location: { lat: expect.closeTo(27.7154, 4) },
      hours: { mon: [['10:00', '20:00']], tue: [] },
    })

    const again = await call('post', '/listings', admin.token, body())
    expect(again.body.data.slug).toBe('momo-hut-2')

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

  it('rejects bad input', async () => {
    const bad = await call('post', '/listings', admin.token, {
      ...body(),
      logoUrl: 'https://evil.example/logo.png',
      website: 'javascript:alert(1)',
      hours: { mon: [['10:00', '10:00']] },
      categoryIds: [],
    })
    expect(bad.status).toBe(400)
    const paths = bad.body.error.details.map((d) => d.path)
    expect(paths).toEqual(expect.arrayContaining(['logoUrl', 'website', 'categoryIds']))
  })

  it('updates (old slug revalidated), changes status, soft deletes', async () => {
    const { data } = (await call('post', '/listings', admin.token, body())).body
    await flushRedis()

    const updated = await call('patch', `/listings/${data.id}`, admin.token, {
      slug: 'momo-hut-thamel',
      location: null,
    })
    expect(updated.body.data).toMatchObject({ slug: 'momo-hut-thamel', location: null })
    const tags = (await jobs(QUEUE.REVALIDATE))[0].data.tags
    expect(tags).toEqual(
      expect.arrayContaining(['listing:momo-hut', 'listing:momo-hut-thamel', `listing:${data.id}`]),
    )
    const [log] = await db.auditLog.findMany({ where: { action: 'business.update' } })
    expect(log.diff.slug).toEqual({ from: 'momo-hut', to: 'momo-hut-thamel' })

    expect(
      (await call('post', `/listings/${data.id}/status`, admin.token, { status: 'SUSPENDED' })).body
        .data.status,
    ).toBe('SUSPENDED')
    expect((await call('delete', `/listings/${data.id}`, admin.token)).status).toBe(200)
    expect((await db.business.findUnique({ where: { id: data.id } })).deletedAt).not.toBeNull()
    expect((await call('get', `/listings/${data.id}`, admin.token)).status).toBe(404)
  })

  it('lists with search and filters', async () => {
    await call('post', '/listings', admin.token, body())
    await call('post', '/listings', admin.token, {
      ...body(),
      name: 'Pizza Place',
      status: 'DRAFT',
    })
    const live = await call('get', '/listings?status=LIVE', admin.token)
    expect(live.body.data.map((l) => l.name)).toEqual(['Momo Hut'])
    const found = await call('get', '/listings?q=pizza', admin.token)
    expect(found.body.data.map((l) => l.name)).toEqual(['Pizza Place'])
    expect(found.body.data[0].category).toEqual({ id: category.id, nameEn: 'Restaurants' })
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

  it('imports CSV rows, creating, updating and reporting errors per row', async () => {
    const tag = await db.tag.create({ data: { slug: 'vegetarian', nameEn: 'Vegetarian' } })
    await createListing({ slug: 'old-cafe', name: 'Old Cafe' })
    const csv = [
      'name,slug,category,tags,area,shortDesc,phone,lat,lng,status',
      `New Place,,restaurants,${tag.slug},thamel,Fresh food,9800000000,27.7,85.3,LIVE`,
      'Old Cafe Renamed,old-cafe,restaurants,,,Updated,,,,',
      'Bad Row,,nowhere,,,Text,,,,',
      ',,restaurants,,,No name,,,,',
    ].join('\n')

    const queued = await call('post', '/listings/import', admin.token, { csv })
    expect(queued.status).toBe(201)
    const status = await call('get', `/listings/import/${queued.body.data.jobId}`, admin.token)
    expect(status.body.data.state).toBe('waiting')

    const result = await importListings({ csv, actorId: admin.user.id, ip: '127.0.0.1' })
    expect(result).toMatchObject({ created: 1, updated: 1, failed: 2 })
    expect(result.errors.map((e) => e.row)).toEqual([4, 5])
    expect(result.errors[0].message).toContain('category nowhere')

    const created = await db.business.findUnique({
      where: { slug: 'new-place' },
      include: { tags: true },
    })
    expect(created).toMatchObject({ status: 'LIVE', areaId: area.id })
    expect(created.tags).toHaveLength(1)
    expect((await db.business.findUnique({ where: { slug: 'old-cafe' } })).name).toBe(
      'Old Cafe Renamed',
    )
    expect(await db.auditLog.count({ where: { action: { startsWith: 'business.import' } } })).toBe(
      2,
    )
  })
})

describe('moderation', () => {
  it('approves a claim: owner set, role raised, rival claims closed, email queued', async () => {
    const listing = await createListing({ name: 'Claimed Place' })
    const claimant = await createUser()
    const rival = await createUser()
    const claim = await db.claim.create({ data: { businessId: listing.id, userId: claimant.id } })
    const other = await db.claim.create({ data: { businessId: listing.id, userId: rival.id } })
    const mod = await tokenFor('MODERATOR')

    expect((await call('post', `/claims/${claim.id}/approve`, mod.token)).status).toBe(200)
    expect((await db.business.findUnique({ where: { id: listing.id } })).ownerId).toBe(claimant.id)
    expect((await db.user.findUnique({ where: { id: claimant.id } })).role).toBe('BUSINESS_OWNER')
    expect((await db.claim.findUnique({ where: { id: other.id } })).status).toBe('REJECTED')
    const email = (await jobs(QUEUE.EMAIL)).find((j) => j.data.template === 'claim-approved')
    expect(email.data.to).toBe(claimant.email)

    expect((await call('post', `/claims/${claim.id}/approve`, mod.token)).status).toBe(409)
  })

  it('rejects a claim with a reason', async () => {
    const listing = await createListing()
    const claimant = await createUser()
    const claim = await db.claim.create({ data: { businessId: listing.id, userId: claimant.id } })
    const mod = await tokenFor('MODERATOR')
    await call('post', `/claims/${claim.id}/reject`, mod.token, { reason: 'No proof' })
    expect((await db.claim.findUnique({ where: { id: claim.id } })).status).toBe('REJECTED')
    const email = (await jobs(QUEUE.EMAIL)).find((j) => j.data.template === 'claim-rejected')
    expect(email.data.data.reason).toBe('No proof')
  })

  it('approving and rejecting reviews keeps the rating current', async () => {
    const listing = await createListing()
    const [a, b] = await Promise.all([createUser(), createUser()])
    const r1 = await db.review.create({ data: { businessId: listing.id, userId: a.id, rating: 5 } })
    const r2 = await db.review.create({ data: { businessId: listing.id, userId: b.id, rating: 2 } })
    const mod = await tokenFor('MODERATOR')

    await call('post', `/reviews/${r1.id}/approve`, mod.token)
    await call('post', `/reviews/${r2.id}/approve`, mod.token)
    let rated = await db.business.findUnique({ where: { id: listing.id } })
    expect([Number(rated.ratingAvg), rated.ratingCount]).toEqual([3.5, 2])

    await call('post', `/reviews/${r2.id}/reject`, mod.token)
    rated = await db.business.findUnique({ where: { id: listing.id } })
    expect([Number(rated.ratingAvg), rated.ratingCount]).toEqual([5, 1])
  })

  it('lists reports with what they are about and resolves them', async () => {
    const listing = await createListing({ name: 'Reported' })
    const report = await db.report.create({
      data: { entityType: 'BUSINESS', entityId: listing.id, reason: 'closed' },
    })
    const mod = await tokenFor('MODERATOR')
    const list = await call('get', '/reports', mod.token)
    expect(list.body.data[0].target).toMatchObject({ name: 'Reported' })
    await call('patch', `/reports/${report.id}`, mod.token, { status: 'RESOLVED' })
    expect(await db.report.findUnique({ where: { id: report.id } })).toMatchObject({
      status: 'RESOLVED',
      handledById: mod.user.id,
    })
  })
})

describe('taxonomy', () => {
  it('refuses reserved group slugs and nesting deeper than group → category', async () => {
    const reserved = await call('post', '/categories', admin.token, {
      kind: 'DIRECTORY',
      nameEn: 'Search',
      slug: 'search',
    })
    expect(reserved.status).toBe(400)
    // An auto slug skips reserved words.
    const auto = await call('post', '/categories', admin.token, {
      kind: 'DIRECTORY',
      nameEn: 'Events',
    })
    expect(auto.body.data.slug).toBe('events-2')
    const deep = await call('post', '/categories', admin.token, {
      kind: 'DIRECTORY',
      nameEn: 'Too deep',
      parentId: category.id,
    })
    expect(deep.status).toBe(400)
  })

  it('reorders, and deletes only empty categories', async () => {
    const cafes = (
      await call('post', '/categories', admin.token, {
        kind: 'DIRECTORY',
        nameEn: 'Cafes',
        parentId: category.parentId,
      })
    ).body.data
    await call('patch', '/categories/reorder', admin.token, {
      items: [
        { id: cafes.id, sortOrder: 0 },
        { id: category.id, sortOrder: 1 },
      ],
    })
    const tree = (await call('get', '/categories', admin.token)).body.data.groups[0]
    expect(tree.children.map((c) => c.slug)).toEqual(['cafes', 'restaurants'])

    await createListing({ categories: { create: { categoryId: category.id, isPrimary: true } } })
    expect((await call('delete', `/categories/${category.id}`, admin.token)).status).toBe(409)
    expect((await call('delete', `/categories/${cafes.id}`, admin.token)).status).toBe(200)
  })

  it('manages tags, areas (with centre) and synonyms', async () => {
    const tag = await call('post', '/tags', admin.token, {
      nameEn: 'Rooftop',
      categoryId: category.id,
    })
    expect(tag.body.data.slug).toBe('rooftop')
    const newArea = await call('post', '/areas', admin.token, {
      nameEn: 'Jhamsikhel',
      district: 'Lalitpur',
      center: { lat: 27.68, lng: 85.308 },
    })
    expect(newArea.status).toBe(201)
    const areas = (await call('get', '/areas', admin.token)).body.data
    expect(areas.find((a) => a.slug === 'jhamsikhel')).toMatchObject({
      lat: expect.closeTo(27.68, 3),
    })

    const syn = await call('post', '/synonyms', admin.token, { term: 'Taxi', synonyms: ['Cab'] })
    expect(syn.body.data).toMatchObject({ term: 'taxi', synonyms: ['cab'] })
    expect(
      (await call('post', '/synonyms', admin.token, { term: 'taxi', synonyms: ['x'] })).status,
    ).toBe(409)
  })
})

describe('content', () => {
  it('builds the homepage: create, reorder, validate links', async () => {
    const a = (await call('post', '/home-sections', admin.token, { type: 'GROUPS' })).body.data
    const b = (
      await call('post', '/home-sections', admin.token, {
        type: 'BANNER',
        title: 'Join',
        config: { href: '/business' },
      })
    ).body.data
    await call('patch', '/home-sections/reorder', admin.token, { ids: [b.id, a.id] })
    expect((await call('get', '/home-sections', admin.token)).body.data.map((s) => s.type)).toEqual(
      ['BANNER', 'GROUPS'],
    )

    const bad = await call('patch', `/home-sections/${b.id}`, admin.token, {
      config: { href: 'javascript:alert(1)' },
    })
    expect(bad.status).toBe(400)
    expect((await jobs(QUEUE.REVALIDATE))[0].data.tags).toContain('home')
  })

  it('sanitizes CMS pages on save and publishes them', async () => {
    const res = await call('post', '/pages', admin.token, {
      slug: 'about',
      title: 'About us',
      body: '<h2>Hello</h2><script>alert(1)</script><p onclick="x()">Hi <a href="javascript:alert(1)">bad</a> <a href="https://example.com">good</a></p>',
    })
    expect(res.status).toBe(201)
    expect(res.body.data.body).toBe(
      '<h2>Hello</h2><p>Hi <a rel="noopener noreferrer">bad</a> <a href="https://example.com" rel="noopener noreferrer">good</a></p>',
    )
    expect((await request(app).get('/api/v1/public/pages/about')).status).toBe(404)
    await call('patch', `/pages/${res.body.data.id}`, admin.token, { isPublished: true })
    const pub = await request(app).get('/api/v1/public/pages/about')
    expect(pub.body.data.title).toBe('About us')
    expect(
      (await call('post', '/pages', admin.token, { slug: 'blog', title: 'x', body: '' })).status,
    ).toBe(400)
  })

  it('validates settings per key', async () => {
    const ok = await call('put', '/settings/emergency_numbers', admin.token, {
      value: [{ label: 'Police', number: '100' }],
    })
    expect(ok.status).toBe(200)
    const bad = await call('put', '/settings/social_links', admin.token, {
      value: [{ platform: 'x', url: 'ftp://x' }],
    })
    expect(bad.status).toBe(400)
    expect((await call('put', '/settings/unknown', admin.token, { value: 1 })).status).toBe(400)
  })

  it('queues a cache purge', async () => {
    await call('post', '/cache/purge', admin.token, { all: true })
    expect((await jobs(QUEUE.CACHE, 'purge'))[0].data).toEqual({ all: true })
  })
})

describe('plans, users, overview', () => {
  it('will not activate a Featured plan without a price', async () => {
    const plan = await db.plan.create({
      data: {
        code: 'FEATURED',
        name: 'Featured',
        priceNpr: 0,
        durationDays: 30,
        isActive: false,
        features: { maxPhotos: 12, maxVideos: 3, featured: true, homepage: true },
      },
    })
    expect((await call('patch', `/plans/${plan.id}`, admin.token, { isActive: true })).status).toBe(
      400,
    )
    expect(
      (await call('patch', `/plans/${plan.id}`, admin.token, { isActive: true, priceNpr: 4000 }))
        .status,
    ).toBe(200)
  })

  it('lets admins suspend members but not staff, and only super admins change roles', async () => {
    const member = await createUser()
    const memberSession = await createSession(member, { mfa: false })
    expect(
      (await call('patch', `/users/${member.id}/status`, admin.token, { status: 'SUSPENDED' }))
        .status,
    ).toBe(200)
    expect(
      await db.session.count({ where: { id: memberSession.session.id, revokedAt: null } }),
    ).toBe(0)

    const otherAdmin = await createUser({ role: 'ADMIN' })
    expect(
      (await call('patch', `/users/${otherAdmin.id}/status`, admin.token, { status: 'SUSPENDED' }))
        .status,
    ).toBe(403)
    expect(
      (await call('patch', `/users/${member.id}/role`, admin.token, { role: 'MODERATOR' })).status,
    ).toBe(403)

    const sa = await tokenFor('SUPER_ADMIN')
    expect(
      (await call('patch', `/users/${member.id}/role`, sa.token, { role: 'MODERATOR' })).body.data
        .role,
    ).toBe('MODERATOR')
    expect(
      (await call('patch', `/users/${sa.user.id}/role`, sa.token, { role: 'ADMIN' })).status,
    ).toBe(403)

    const listed = await call('get', '/users?role=MODERATOR', admin.token)
    expect(listed.body.data.map((u) => u.id)).toEqual([member.id])
    const audit = await call('get', '/audit?entity=user', sa.token)
    expect(audit.body.data.map((a) => a.action)).toEqual(['user.role', 'user.status'])
  })

  it('summarises the site', async () => {
    await createListing({ status: 'LIVE' })
    await createListing({ status: 'DRAFT' })
    const res = await call('get', '/overview', admin.token)
    expect(res.body.data).toMatchObject({
      listings: { LIVE: 1, DRAFT: 1 },
      pending: { claims: 0 },
      revenueThisMonthNpr: 0,
    })
  })
})

describe('public contact form', () => {
  it('emails the contact address from Settings, replying to the sender', async () => {
    await db.setting.create({ data: { key: 'contact', value: { email: 'team@atk.test' } } })
    const res = await request(app).post('/api/v1/public/contact').send({
      name: 'Visitor',
      email: 'visitor@example.com',
      message: 'Please add my shop to the site.',
    })
    expect(res.status).toBe(201)
    const [job] = await jobs(QUEUE.EMAIL)
    expect(job.data).toMatchObject({
      to: 'team@atk.test',
      template: 'contact-message',
      replyTo: 'visitor@example.com',
    })
  })
})
