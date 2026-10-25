import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { getQueue, QUEUE } from '../src/jobs/queues.js'
import { createListing, resetDb } from './helpers/db.js'
import { PASSWORD, cookieValue, createUser, flushRedis } from './helpers/auth.js'

const app = createApp()
const auth = (path) => `/api/v1/auth${path}`
const me = (path = '') => `/api/v1/me${path}`

/** Logs in through the API so the session, cookies and user agent are real. */
async function login(email, password = PASSWORD, userAgent = 'vitest') {
  const res = await request(app)
    .post(auth('/login'))
    .set('User-Agent', userAgent)
    .send({ email, password })
  expect(res.status).toBe(200)
  return { token: res.body.data.accessToken, rt: cookieValue(res, 'atk_rt') }
}

const as = (token) => ({
  get: (path) => request(app).get(me(path)).set('Authorization', `Bearer ${token}`),
  patch: (path, body) =>
    request(app).patch(me(path)).set('Authorization', `Bearer ${token}`).send(body),
  put: (path) => request(app).put(me(path)).set('Authorization', `Bearer ${token}`),
  post: (path, body) =>
    request(app).post(me(path)).set('Authorization', `Bearer ${token}`).send(body),
  delete: (path, body) =>
    request(app).delete(me(path)).set('Authorization', `Bearer ${token}`).send(body),
})

let user
let api

beforeEach(async () => {
  await resetDb()
  await flushRedis()
  user = await createUser({ name: 'Sita Sharma' })
  api = as((await login(user.email)).token)
})

describe('profile', () => {
  it('reads and updates the profile; phone numbers stay unique', async () => {
    const res = await api.get('')
    expect(res.body.data).toMatchObject({
      email: user.email,
      name: 'Sita Sharma',
      hasPassword: true,
      googleLinked: false,
    })
    expect(res.body.data.passwordHash).toBeUndefined()

    const updated = await api.patch('', { name: 'Sita K. Sharma', phone: '+977 9801234567' })
    expect(updated.body.data).toMatchObject({ name: 'Sita K. Sharma', phone: '+977 9801234567' })

    await createUser({ phone: '9800000000' })
    const taken = await api.patch('', { phone: '9800000000' })
    expect(taken.status).toBe(409)
    expect(taken.body.error.details[0].path).toBe('phone')
    expect((await api.patch('', {})).status).toBe(400)
    expect((await api.patch('', { role: 'SUPER_ADMIN' })).status).toBe(400)
  })

  it('requires a login', async () => {
    expect((await request(app).get(me())).status).toBe(401)
  })
})

describe('password', () => {
  it('checks the current password and signs out other devices only', async () => {
    const phone = await login(user.email, PASSWORD, 'phone')
    const laptop = await login(user.email, PASSWORD, 'laptop')
    const wrong = await as(laptop.token).patch('/password', {
      currentPassword: 'Nope-12345',
      newPassword: 'New-Password-77',
    })
    expect(wrong.status).toBe(400)
    expect(wrong.body.error.details[0].path).toBe('currentPassword')

    const changed = await as(laptop.token).patch('/password', {
      currentPassword: PASSWORD,
      newPassword: 'New-Password-77',
    })
    expect(changed.status).toBe(200)
    expect((await as(phone.token).get('')).status).toBe(401)
    expect((await as(laptop.token).get('')).status).toBe(200)
    expect(
      (await request(app).post(auth('/login')).send({ email: user.email, password: PASSWORD }))
        .status,
    ).toBe(401)
    await login(user.email, 'New-Password-77')
  })

  it('lets a Google-only account set a first password', async () => {
    await db.user.update({ where: { id: user.id }, data: { passwordHash: null, googleId: 'g-1' } })
    const res = await api.patch('/password', { newPassword: 'First-Password-1' })
    expect(res.status).toBe(200)
    await login(user.email, 'First-Password-1')
  })

  it('limits password checks to 5 per 15 minutes', async () => {
    for (let i = 0; i < 5; i += 1) {
      await api.patch('/password', {
        currentPassword: 'Nope-12345',
        newPassword: 'New-Password-77',
      })
    }
    const blocked = await api.patch('/password', {
      currentPassword: PASSWORD,
      newPassword: 'New-Password-77',
    })
    expect(blocked.status).toBe(429)
  })
})

describe('sessions', () => {
  it('lists active devices and signs one out', async () => {
    const other = await login(user.email, PASSWORD, 'Other browser')
    const list = await api.get('/sessions')
    expect(list.body.data).toHaveLength(2)
    expect(list.body.data.filter((s) => s.current)).toHaveLength(1)
    const target = list.body.data.find((s) => s.userAgent === 'Other browser')
    expect(target.current).toBe(false)

    expect((await api.delete(`/sessions/${target.id}`)).status).toBe(204)
    expect((await as(other.token).get('')).status).toBe(401)
    expect((await api.get('/sessions')).body.data).toHaveLength(1)

    const stranger = await createUser()
    const theirs = await login(stranger.email)
    const [theirSession] = (await as(theirs.token).get('/sessions')).body.data
    expect((await api.delete(`/sessions/${theirSession.id}`)).status).toBe(404)
  })

  it('clears the cookies when the current session is signed out', async () => {
    const [current] = (await api.get('/sessions')).body.data
    const res = await api.delete(`/sessions/${current.id}`)
    expect(res.status).toBe(204)
    expect(res.headers['set-cookie'].some((c) => c.startsWith('atk_rt=;'))).toBe(true)
  })
})

describe('saved listings', () => {
  it('saves, lists newest first, filters by listing and unsaves', async () => {
    const first = await createListing({ name: 'Himalayan Java' })
    const second = await createListing({ name: 'Roadhouse Cafe' })
    const draft = await createListing({ status: 'DRAFT' })

    expect((await api.put(`/saved/${first.id}`)).body.data.saved).toBe(true)
    await new Promise((r) => setTimeout(r, 5))
    await api.put(`/saved/${second.id}`)
    expect((await api.put(`/saved/${second.id}`)).status).toBe(200) // idempotent
    expect((await api.put(`/saved/${draft.id}`)).status).toBe(404)

    const page1 = await api.get('/saved?limit=1')
    expect(page1.body.data.map((c) => c.name)).toEqual(['Roadhouse Cafe'])
    expect(page1.body.data[0]).toHaveProperty('rating')
    const page2 = await api.get(`/saved?limit=1&cursor=${page1.body.meta.nextCursor}`)
    expect(page2.body.data.map((c) => c.name)).toEqual(['Himalayan Java'])
    expect(page2.body.meta.nextCursor).toBeNull()

    expect((await api.get(`/saved?businessId=${first.id}`)).body.data).toHaveLength(1)
    await api.delete(`/saved/${first.id}`)
    expect((await api.get(`/saved?businessId=${first.id}`)).body.data).toHaveLength(0)

    // Unpublished listings drop out of the list.
    await db.business.update({ where: { id: second.id }, data: { status: 'SUSPENDED' } })
    expect((await api.get('/saved')).body.data).toHaveLength(0)
  })
})

describe('reviews', () => {
  const approve = (id) => db.review.update({ where: { id }, data: { status: 'APPROVED' } })
  const ratingOf = async (id) => {
    const b = await db.business.findUnique({ where: { id } })
    return [Number(b.ratingAvg), b.ratingCount]
  }

  it('creates one pending review per listing, never for your own listing', async () => {
    const listing = await createListing()
    const res = await api.post('/reviews', {
      businessId: listing.id,
      rating: 4,
      body: '  Good momo ',
    })
    expect(res.status).toBe(201)
    expect(res.body.data).toMatchObject({ rating: 4, body: 'Good momo', status: 'PENDING' })
    expect(res.body.data.listing).toMatchObject({ slug: listing.slug, live: true })

    const again = await api.post('/reviews', { businessId: listing.id, rating: 5 })
    expect(again.status).toBe(409)
    expect(again.body.error.code).toBe('ALREADY_REVIEWED')

    const own = await createListing({ ownerId: user.id })
    expect((await api.post('/reviews', { businessId: own.id, rating: 5 })).status).toBe(403)
    const draft = await createListing({ status: 'DRAFT' })
    expect((await api.post('/reviews', { businessId: draft.id, rating: 5 })).status).toBe(404)
    expect((await api.post('/reviews', { businessId: listing.id, rating: 6 })).status).toBe(400)

    // Pending reviews are not public.
    const pub = await request(app).get(`/api/v1/public/listings/${listing.slug}/reviews`)
    expect(pub.body.data).toHaveLength(0)
  })

  it('sends an edited review back to moderation and out of the rating', async () => {
    const listing = await createListing()
    const { body } = await api.post('/reviews', { businessId: listing.id, rating: 5 })
    await approve(body.data.id)
    await db.$executeRaw`UPDATE businesses SET "ratingAvg" = 5, "ratingCount" = 1 WHERE id = ${listing.id}::uuid`

    const edited = await api.patch(`/reviews/${body.data.id}`, { rating: 2, body: 'Changed' })
    expect(edited.body.data).toMatchObject({ rating: 2, body: 'Changed', status: 'PENDING' })
    expect(await ratingOf(listing.id)).toEqual([0, 0])
    const jobs = await getQueue(QUEUE.REVALIDATE).getJobs(['waiting'])
    expect(jobs.flatMap((j) => j.data.tags)).toContain(`listing:${listing.slug}`)

    const mine = await api.get('/reviews')
    expect(mine.body.data).toHaveLength(1)
    expect(mine.body.data[0].status).toBe('PENDING')
  })

  it('deletes an own review and recomputes the rating', async () => {
    const listing = await createListing()
    const other = await createUser()
    const otherApi = as((await login(other.email)).token)
    const mine = (await api.post('/reviews', { businessId: listing.id, rating: 5 })).body.data
    const theirs = (await otherApi.post('/reviews', { businessId: listing.id, rating: 3 })).body
      .data
    await approve(mine.id)
    await approve(theirs.id)

    expect((await otherApi.delete(`/reviews/${mine.id}`)).status).toBe(404)
    expect((await otherApi.patch(`/reviews/${mine.id}`, { rating: 1 })).status).toBe(404)
    expect((await api.delete(`/reviews/${mine.id}`)).status).toBe(204)
    expect(await ratingOf(listing.id)).toEqual([3, 1])
  })
})

describe('account deletion', () => {
  it('confirms with the password, anonymises the account and frees the email', async () => {
    const owned = await createListing({ ownerId: user.id })
    const reviewed = await createListing()
    const review = (await api.post('/reviews', { businessId: reviewed.id, rating: 4 })).body.data
    await db.review.update({ where: { id: review.id }, data: { status: 'APPROVED' } })
    await api.put(`/saved/${reviewed.id}`)
    await db.claim.create({ data: { businessId: reviewed.id, userId: user.id } })

    expect((await api.delete('', { confirm: 'DELETE', password: 'Nope-1234' })).status).toBe(400)
    expect((await api.delete('', { password: PASSWORD })).status).toBe(400)
    const res = await api.delete('', { confirm: 'DELETE', password: PASSWORD })
    expect(res.status).toBe(204)
    expect(res.headers['set-cookie'].some((c) => c.startsWith('atk_rt=;'))).toBe(true)

    const gone = await db.user.findUnique({ where: { id: user.id } })
    expect(gone).toMatchObject({ name: 'Former member', phone: null, passwordHash: null })
    expect(gone.deletedAt).not.toBeNull()
    expect(gone.email).not.toBe(user.email)
    expect((await api.get('')).status).toBe(401)

    expect((await db.business.findUnique({ where: { id: owned.id } })).ownerId).toBeNull()
    expect(await db.savedListing.count()).toBe(0)
    expect((await db.claim.findFirst()).status).toBe('REJECTED')
    expect(await db.auditLog.count({ where: { action: 'user.delete' } })).toBe(1)

    // The review stays, without a name; the email can register again.
    const pub = await request(app).get(`/api/v1/public/listings/${reviewed.slug}/reviews`)
    expect(pub.body.data[0].author).toEqual({ name: null, avatarUrl: null })
    const again = await createUser({ email: user.email })
    expect(again.id).not.toBe(user.id)
  })

  it('keeps staff accounts', async () => {
    await db.user.update({ where: { id: user.id }, data: { role: 'MODERATOR' } })
    const res = await api.delete('', { confirm: 'DELETE', password: PASSWORD })
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('STAFF_ACCOUNT')
  })
})
