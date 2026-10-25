import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { cloudinary } from '../src/config/cloudinary.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { nepalDayStart } from '../src/services/events.js'
import { createSession } from '../src/services/token.js'
import { createListing, resetDb } from './helpers/db.js'
import { createUser, flushRedis } from './helpers/auth.js'

const app = createApp()
const DAY = 24 * 60 * 60 * 1000
const inDays = (n) => new Date(Date.now() + n * DAY).toISOString()

async function tokenFor(role) {
  const user = await createUser({ role, totpEnabled: !['MEMBER', 'BUSINESS_OWNER'].includes(role) })
  const { accessToken } = await createSession(user, {
    mfa: !['MEMBER', 'BUSINESS_OWNER'].includes(role),
  })
  return { user, token: accessToken }
}

const call = (method, path, token, body) => {
  const req = request(app)[method](`/api/v1${path}`)
  if (token) req.set('Authorization', `Bearer ${token}`)
  return body === undefined ? req : req.send(body)
}

const jobs = async (queue) => getQueue(queue).getJobs(['waiting', 'delayed'])

function mockUpload() {
  return vi.spyOn(cloudinary.api, 'resource').mockImplementation(async (publicId) => ({
    public_id: publicId,
    secure_url: `https://res.cloudinary.com/atk-test/image/upload/v1/${publicId}.jpg`,
    bytes: 100_000,
    format: 'jpg',
    width: 1200,
    height: 600,
  }))
}

let member
let mod
let thamel
let patan

const event = (overrides = {}) => ({
  title: 'Jazzmandu Opening Night',
  description: 'Live jazz.',
  startsAt: inDays(3),
  endsAt: null,
  venue: 'Patan Durbar Square',
  areaId: patan.id,
  location: { lat: 27.673, lng: 85.325 },
  ticketUrl: 'https://example.com/tickets',
  ...overrides,
})

async function approved(overrides) {
  const res = await call('post', '/me/events', member.token, event(overrides))
  expect(res.status).toBe(201)
  await call('post', `/admin/events/${res.body.data.id}/approve`, mod.token)
  return res.body.data
}

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  member = await tokenFor('MEMBER')
  mod = await tokenFor('MODERATOR')
  thamel = await db.area.create({
    data: { slug: 'thamel', nameEn: 'Thamel', district: 'Kathmandu' },
  })
  patan = await db.area.create({ data: { slug: 'patan', nameEn: 'Patan', district: 'Lalitpur' } })
})
afterEach(() => vi.restoreAllMocks())

describe('event submissions', () => {
  it('lets members submit with a cover; nothing is public until approved', async () => {
    mockUpload()
    const sign = await call('post', '/me/events/cover/sign', member.token)
    expect(sign.body.data.public_id).toContain(`/events/${member.user.id}/cover-`)

    const res = await call('post', '/me/events', member.token, {
      ...event(),
      coverPublicId: sign.body.data.public_id,
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ status: 'PENDING', title: 'Jazzmandu Opening Night' })
    expect(res.body.data.slug).toMatch(/^jazzmandu-opening-night-\d{4}-\d{2}-\d{2}$/)
    expect(res.body.data.coverUrl).toContain('res.cloudinary.com')

    expect((await call('get', '/public/events')).body.data).toHaveLength(0)
    expect((await call('get', `/public/events/${res.body.data.slug}`)).status).toBe(404)
    expect((await call('get', '/me/events', member.token)).body.data).toHaveLength(1)
  })

  it('checks dates and cover ownership', async () => {
    const past = await call('post', '/me/events', member.token, event({ startsAt: inDays(-1) }))
    expect(past.status).toBe(400)
    const backwards = await call(
      'post',
      '/me/events',
      member.token,
      event({ startsAt: inDays(3), endsAt: inDays(2) }),
    )
    expect(backwards.status).toBe(400)
    const tooLong = await call('post', '/me/events', member.token, event({ endsAt: inDays(40) }))
    expect(tooLong.status).toBe(400)

    mockUpload()
    const stranger = await tokenFor('MEMBER')
    const theirs = (await call('post', '/me/events/cover/sign', stranger.token)).body.data
    const stolen = await call('post', '/me/events', member.token, {
      ...event(),
      coverPublicId: theirs.public_id,
    })
    expect(stolen.status).toBe(400)
  })

  it('lets owners submit for their own listing only', async () => {
    const owner = await tokenFor('BUSINESS_OWNER')
    const listing = await createListing({ ownerId: owner.user.id })
    const other = await createListing()

    const res = await call('post', `/business/listings/${listing.id}/events`, owner.token, event())
    expect(res.status).toBe(201)
    expect(res.body.data.business).toMatchObject({ slug: listing.slug })
    expect(
      (await call('post', `/business/listings/${other.id}/events`, owner.token, event())).status,
    ).toBe(404)
    const mine = await call('get', `/business/listings/${listing.id}/events`, owner.token)
    expect(mine.body.data.map((e) => e.id)).toEqual([res.body.data.id])
    expect((await call('post', '/business/listings/x/events', member.token, event())).status).toBe(
      403,
    )
  })
})

describe('moderation and the public calendar', () => {
  it('approves into the calendar with tags purged, and rejects back out', async () => {
    const e = await approved()
    const list = await call('get', '/public/events')
    expect(list.body.data.map((x) => x.slug)).toEqual([e.slug])
    const detail = await call('get', `/public/events/${e.slug}`)
    expect(detail.body.data).toMatchObject({
      title: 'Jazzmandu Opening Night',
      ticketUrl: 'https://example.com/tickets',
      area: { slug: 'patan' },
    })
    expect(detail.body.data.location.lat).toBeCloseTo(27.673, 3)

    const revalidate = (await jobs(QUEUE.REVALIDATE)).flatMap((j) => j.data.tags)
    expect(revalidate).toEqual(expect.arrayContaining(['events', 'home', `event:${e.slug}`]))
    const purge = (await jobs(QUEUE.CACHE)).flatMap((j) => j.data.tags)
    expect(purge).toEqual(expect.arrayContaining(['events', `event:${e.id}`]))
    expect(await db.auditLog.count({ where: { action: 'event.approve' } })).toBe(1)

    await call('post', `/admin/events/${e.id}/reject`, mod.token, { reason: 'Duplicate' })
    await flushRedis()
    expect((await call('get', '/public/events')).body.data).toHaveLength(0)
  })

  it('lists from today in Kathmandu, keeps running events, filters by area and dates', async () => {
    const running = await approved({ title: 'Book Fair', startsAt: inDays(1), endsAt: inDays(5) })
    await db.event.update({
      where: { id: running.id },
      data: { startsAt: new Date(Date.now() - 2 * DAY) },
    })
    const ended = await approved({ title: 'Old Show', startsAt: inDays(1) })
    await db.event.update({
      where: { id: ended.id },
      data: { startsAt: new Date(Date.now() - 3 * DAY) },
    })
    await approved({ title: 'Thamel Night', startsAt: inDays(2), areaId: thamel.id })
    await approved({ title: 'Patan Concert', startsAt: inDays(10) })

    const all = await call('get', '/public/events?limit=2')
    expect(all.body.data.map((e) => e.title)).toEqual(['Book Fair', 'Thamel Night'])
    const next = await call('get', `/public/events?limit=2&cursor=${all.body.meta.nextCursor}`)
    expect(next.body.data.map((e) => e.title)).toEqual(['Patan Concert'])
    expect(next.body.meta.nextCursor).toBeNull()

    expect((await call('get', '/public/events?area=thamel')).body.data.map((e) => e.title)).toEqual(
      ['Thamel Night'],
    )
    const to = encodeURIComponent(inDays(5))
    expect((await call('get', `/public/events?to=${to}`)).body.data).toHaveLength(2)
  })

  it('lets moderators edit and delete (cover removed from Cloudinary); members cannot', async () => {
    mockUpload()
    const sign = (await call('post', '/me/events/cover/sign', member.token)).body.data
    const created = await call('post', '/me/events', member.token, {
      ...event(),
      coverPublicId: sign.public_id,
    })
    const { id } = created.body.data

    expect((await call('get', '/admin/events', member.token)).status).toBe(403)
    const queue = await call('get', '/admin/events', mod.token)
    expect(queue.body.data[0].submittedBy).toMatchObject({ id: member.user.id })

    const edited = await call('patch', `/admin/events/${id}`, mod.token, {
      venue: 'Patan Museum',
      location: null,
    })
    expect(edited.body.data.venue).toBe('Patan Museum')

    expect((await call('delete', `/admin/events/${id}`, mod.token)).status).toBe(204)
    const deletes = (await jobs(QUEUE.MEDIA)).map((j) => j.data.publicId)
    expect(deletes).toContain(sign.public_id)
    expect(await db.event.count()).toBe(0)
  })

  it('computes the start of the Kathmandu day', () => {
    // 20:00 UTC on 1 Nov is 01:45 on 2 Nov in Kathmandu, whose midnight is 18:15 UTC on 1 Nov.
    expect(nepalDayStart(new Date('2026-11-01T20:00:00Z')).toISOString()).toBe(
      '2026-11-01T18:15:00.000Z',
    )
  })
})
