import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import express from 'express'
import request from 'supertest'
import { db } from '../src/config/db.js'
import { verifyToken, optionalAuth } from '../src/middleware/auth.js'
import { requireRole } from '../src/middleware/requireRole.js'
import { requireOwnership } from '../src/middleware/ownership.js'
import { errorHandler } from '../src/middleware/errorHandler.js'
import { createSession } from '../src/services/token.js'
import { resetDb, createListing } from './helpers/db.js'
import { createUser, flushRedis } from './helpers/auth.js'

const app = express()
app.get('/me', verifyToken, (req, res) => res.json({ id: req.user.id, mfa: req.auth.mfa }))
app.get('/maybe', optionalAuth, (req, res) => res.json({ id: req.user?.id ?? null }))
app.get('/admin', verifyToken, requireRole('ADMIN', 'MODERATOR'), (req, res) => res.json({ ok: 1 }))
app.get('/super', verifyToken, requireRole('SUPER_ADMIN'), (req, res) => res.json({ ok: 1 }))
app.get('/owner', verifyToken, requireRole('BUSINESS_OWNER'), (req, res) => res.json({ ok: 1 }))
app.get('/listings/:id', verifyToken, requireOwnership, (req, res) =>
  res.json({ id: req.listing.id }),
)
app.use(errorHandler)

const tokenFor = async (user, mfa = false) =>
  (await createSession(user, { userAgent: 'test', ip: '127.0.0.1', mfa })).accessToken
const get = (path, token) =>
  request(app)
    .get(path)
    .set('Authorization', token ? `Bearer ${token}` : '')

beforeEach(async () => {
  await resetDb()
  await flushRedis()
})
afterEach(() => vi.restoreAllMocks())

describe('verifyToken', () => {
  it('accepts a valid token and re-reads the user', async () => {
    const user = await createUser()
    const token = await tokenFor(user)
    const res = await get('/me', token)
    expect(res.body).toEqual({ id: user.id, mfa: false })

    await db.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } })
    const suspended = await get('/me', token)
    expect(suspended.status).toBe(401)
    expect(suspended.body.error.code).toBe('ACCOUNT_UNAVAILABLE')
  })

  it('rejects missing, malformed and alg=none tokens', async () => {
    expect((await get('/me')).status).toBe(401)
    expect((await get('/me', 'abc')).body.error.code).toBe('TOKEN_INVALID')
    const none =
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ0eXAiOiJhY2Nlc3MiLCJzdWIiOiJ4Iiwic2lkIjoieSJ9.'
    expect((await get('/me', none)).status).toBe(401)
  })

  it('optionalAuth treats a bad token as anonymous', async () => {
    const user = await createUser()
    expect((await get('/maybe', await tokenFor(user))).body.id).toBe(user.id)
    expect((await get('/maybe', 'garbage')).body.id).toBeNull()
  })
})

describe('requireRole', () => {
  it('admits staff with 2FA, ranks SUPER_ADMIN above ADMIN above MODERATOR', async () => {
    for (const role of ['MODERATOR', 'ADMIN', 'SUPER_ADMIN']) {
      const staff = await createUser({ role, totpEnabled: true })
      expect((await get('/admin', await tokenFor(staff, true))).status).toBe(200)
    }
    const admin = await createUser({ role: 'ADMIN', totpEnabled: true })
    expect((await get('/super', await tokenFor(admin, true))).status).toBe(403)
  })

  it('refuses staff sessions that did not pass 2FA', async () => {
    const promoted = await createUser({ role: 'ADMIN', totpEnabled: false })
    const res = await get('/admin', await tokenFor(promoted, false))
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('TWO_FACTOR_REQUIRED')

    const noMfaSession = await createUser({ role: 'ADMIN', totpEnabled: true })
    expect((await get('/admin', await tokenFor(noMfaSession, false))).status).toBe(403)
  })

  it('keeps members and business owners out of staff routes and vice versa', async () => {
    const member = await createUser()
    expect((await get('/admin', await tokenFor(member))).status).toBe(403)
    const owner = await createUser({ role: 'BUSINESS_OWNER' })
    expect((await get('/owner', await tokenFor(owner))).status).toBe(200)
    const admin = await createUser({ role: 'ADMIN', totpEnabled: true })
    expect((await get('/owner', await tokenFor(admin, true))).status).toBe(403)
  })
})

describe('requireOwnership', () => {
  it("lets owners through and answers 404 for other owners' and unknown listings", async () => {
    const owner = await createUser({ role: 'BUSINESS_OWNER' })
    const other = await createUser({ role: 'BUSINESS_OWNER' })
    const listing = await createListing({ ownerId: owner.id })

    expect((await get(`/listings/${listing.id}`, await tokenFor(owner))).body).toEqual({
      id: listing.id,
    })
    expect((await get(`/listings/${listing.id}`, await tokenFor(other))).status).toBe(404)
    expect((await get('/listings/not-a-uuid', await tokenFor(owner))).status).toBe(404)

    await db.business.update({ where: { id: listing.id }, data: { deletedAt: new Date() } })
    expect((await get(`/listings/${listing.id}`, await tokenFor(owner))).status).toBe(404)
  })
})
