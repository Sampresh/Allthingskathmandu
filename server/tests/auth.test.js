import { describe, it, expect, beforeEach } from 'vitest'
import request from 'supertest'
import { generate } from 'otplib'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { decryptSecret } from '../src/services/totp.js'
import { resetDb } from './helpers/db.js'
import {
  PASSWORD,
  cookieHeader,
  cookieValue,
  createUser,
  emailJobs,
  flushRedis,
  sleep,
  tokenFromUrl,
  waitForEmail,
} from './helpers/auth.js'

const app = createApp()
const api = (path) => `/api/v1/auth${path}`

const login = (email, password = PASSWORD) =>
  request(app).post(api('/login')).send({ email, password })

const refresh = (rt) => request(app).post(api('/refresh')).set('Cookie', `atk_rt=${rt}`)

beforeEach(async () => {
  await resetDb()
  await flushRedis()
})

describe('register and verify email', () => {
  it('registers, blocks login until verified, then verifies once', async () => {
    const email = 'new.member@atk.test'
    const res = await request(app)
      .post(api('/register'))
      .send({ name: 'New Member', email: '  New.Member@ATK.test ', password: PASSWORD })
    expect(res.status).toBe(201)
    expect(res.body.data.message).toMatch(/check your email/i)

    const mail = await waitForEmail(email, 'verify-email')
    const user = await db.user.findUnique({ where: { email } })
    expect(user.emailVerifiedAt).toBeNull()
    expect(user.passwordHash).toMatch(/^\$2[aby]\$12\$/)
    expect(user.role).toBe('MEMBER')

    const early = await login(email)
    expect(early.status).toBe(403)
    expect(early.body.error.code).toBe('EMAIL_NOT_VERIFIED')

    const token = tokenFromUrl(mail.data.url)
    expect(mail.data.url).toContain('http://localhost:3000/verify-email?token=')
    const verified = await request(app).post(api('/verify-email')).send({ token })
    expect(verified.status).toBe(200)

    const again = await request(app).post(api('/verify-email')).send({ token })
    expect(again.status).toBe(400)
    expect(again.body.error.code).toBe('TOKEN_INVALID')

    const ok = await login(email)
    expect(ok.status).toBe(200)
    expect(ok.body.data.accessToken).toEqual(expect.any(String))
    expect(ok.body.data.user).toMatchObject({ email, role: 'MEMBER', emailVerified: true })
  })

  it('gives the same answer for an existing email and sends that owner a notice instead', async () => {
    const existing = await createUser()
    const res = await request(app)
      .post(api('/register'))
      .send({ name: 'Someone', email: existing.email, password: 'Another-Pass-1' })
    expect(res.status).toBe(201)
    expect(res.body.data.message).toMatch(/check your email/i)

    await waitForEmail(existing.email, 'account-exists')
    expect(await db.user.count({ where: { email: existing.email } })).toBe(1)
  })

  it('validates input', async () => {
    const res = await request(app)
      .post(api('/register'))
      .send({ name: '', email: 'not-an-email', password: 'short' })
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.map((d) => d.path).sort()).toEqual(['email', 'name', 'password'])
  })

  it('resends verification only to unverified accounts, with the same answer for all', async () => {
    const unverified = await createUser({ emailVerifiedAt: null })
    const verified = await createUser()

    const answers = await Promise.all(
      [unverified.email, verified.email, 'nobody@atk.test'].map((email) =>
        request(app).post(api('/resend-verification')).send({ email }),
      ),
    )
    expect(new Set(answers.map((r) => JSON.stringify([r.status, r.body]))).size).toBe(1)

    await waitForEmail(unverified.email, 'verify-email')
    await sleep(200)
    const recipients = (await emailJobs()).map((j) => j.data.to)
    expect(recipients).toEqual([unverified.email])
  })
})

describe('login', () => {
  it('sets the refresh cookie and the session hint cookie', async () => {
    const user = await createUser()
    const res = await login(user.email)
    expect(res.status).toBe(200)

    const rt = cookieHeader(res, 'atk_rt')
    expect(rt).toMatch(/HttpOnly/)
    expect(rt).toMatch(/Path=\/api\/v1\/auth/)
    expect(rt).toMatch(/SameSite=Lax/)
    const hint = cookieHeader(res, 'atk_session')
    expect(hint).toMatch(/^atk_session=1;.*Path=\//)
    expect(hint).not.toMatch(/HttpOnly/)
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1)
  })

  it('answers wrong password and unknown email identically', async () => {
    const user = await createUser()
    const wrong = await login(user.email, 'Wrong-Password-1')
    const unknown = await login('nobody@atk.test', 'Wrong-Password-1')
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.body).toEqual(unknown.body)
    expect(wrong.body.error.code).toBe('INVALID_CREDENTIALS')
  })

  it('refuses suspended accounts', async () => {
    const user = await createUser({ status: 'SUSPENDED' })
    const res = await login(user.email)
    expect(res.status).toBe(403)
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED')
  })

  it('locks the account progressively after repeated failures', async () => {
    const user = await createUser()
    for (let i = 0; i < 5; i += 1) {
      await flushRedis() // spread across "IPs" so only the account lockout applies
      expect((await login(user.email, 'Wrong-Password-1')).status).toBe(401)
    }
    const locked = await db.user.findUnique({ where: { id: user.id } })
    expect(locked.failedLogins).toBe(5)
    const firstLockMs = locked.lockedUntil.getTime() - Date.now()
    expect(firstLockMs).toBeGreaterThan(14 * 60_000)
    expect(firstLockMs).toBeLessThanOrEqual(15 * 60_000)

    await flushRedis()
    const blocked = await login(user.email) // correct password, still locked
    expect(blocked.status).toBe(423)
    expect(blocked.body.error.code).toBe('ACCOUNT_LOCKED')

    // After the lock expires, the next failure locks for twice as long.
    await db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() - 1000) },
    })
    await flushRedis()
    await login(user.email, 'Wrong-Password-1')
    const relocked = await db.user.findUnique({ where: { id: user.id } })
    expect(relocked.lockedUntil.getTime() - Date.now()).toBeGreaterThan(29 * 60_000)

    // A successful login clears the counter.
    await db.user.update({ where: { id: user.id }, data: { lockedUntil: null } })
    await flushRedis()
    expect((await login(user.email)).status).toBe(200)
    expect((await db.user.findUnique({ where: { id: user.id } })).failedLogins).toBe(0)
  })

  it('rate limits login to 5 per 15 minutes per IP and email', async () => {
    const user = await createUser()
    for (let i = 0; i < 5; i += 1) await login(user.email, 'Wrong-Password-1')
    const sixth = await login(user.email)
    expect(sixth.status).toBe(429)
    expect(sixth.body.error.code).toBe('RATE_LIMITED')
  })
})

describe('refresh tokens', () => {
  it('rotates on every refresh', async () => {
    const user = await createUser()
    const first = cookieValue(await login(user.email), 'atk_rt')

    const r1 = await refresh(first)
    expect(r1.status).toBe(200)
    expect(r1.body.data.accessToken).toEqual(expect.any(String))
    const second = cookieValue(r1, 'atk_rt')
    expect(second).toBeDefined()
    expect(second).not.toBe(first)

    const r2 = await refresh(second)
    expect(r2.status).toBe(200)
    expect(await db.session.count({ where: { userId: user.id } })).toBe(1)
  })

  it('stores only a hash of the refresh token', async () => {
    const user = await createUser()
    const rt = cookieValue(await login(user.email), 'atk_rt')
    const session = await db.session.findFirst({ where: { userId: user.id } })
    expect(session.tokenHash).not.toBe(rt)
    expect(session.tokenHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('detects reuse of a rotated token and revokes every session', async () => {
    const user = await createUser()
    const loginRes = await login(user.email)
    const stolen = cookieValue(loginRes, 'atk_rt')
    const otherDevice = cookieValue(await login(user.email), 'atk_rt')

    const rotated = await refresh(stolen)
    const current = cookieValue(rotated, 'atk_rt')
    const access = rotated.body.data.accessToken

    const reuse = await refresh(stolen)
    expect(reuse.status).toBe(401)
    expect(reuse.body.error.code).toBe('REFRESH_REUSED')
    expect(cookieHeader(reuse, 'atk_rt')).toMatch(/Expires=Thu, 01 Jan 1970/)

    expect((await refresh(current)).status).toBe(401)
    expect((await refresh(otherDevice)).status).toBe(401)
    const protectedCall = await request(app)
      .post(api('/logout-all'))
      .set('Authorization', `Bearer ${access}`)
    expect(protectedCall.status).toBe(401)
    expect(protectedCall.body.error.code).toBe('SESSION_REVOKED')
    expect(await db.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0)
  })

  it('rejects missing, garbage and forged refresh tokens', async () => {
    expect((await request(app).post(api('/refresh'))).status).toBe(401)
    expect((await refresh('garbage')).status).toBe(401)
    const forged =
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ0eXAiOiJyZWZyZXNoIiwic3ViIjoieCIsInNpZCI6InkifQ.'
    expect((await refresh(forged)).status).toBe(401)
  })

  it('logout revokes the session; logout-all revokes every session', async () => {
    const user = await createUser()
    const a = cookieValue(await login(user.email), 'atk_rt')
    const bRes = await login(user.email)
    const b = cookieValue(bRes, 'atk_rt')
    const c = cookieValue(await login(user.email), 'atk_rt')

    const out = await request(app).post(api('/logout')).set('Cookie', `atk_rt=${a}`)
    expect(out.status).toBe(204)
    expect(cookieHeader(out, 'atk_session')).toMatch(/Expires=Thu, 01 Jan 1970/)
    expect((await refresh(a)).status).toBe(401)
    expect((await refresh(b)).status).toBe(200)

    const unauthenticated = await request(app).post(api('/logout-all'))
    expect(unauthenticated.status).toBe(401)

    const fresh = await refresh(c)
    const all = await request(app)
      .post(api('/logout-all'))
      .set('Authorization', `Bearer ${fresh.body.data.accessToken}`)
    expect(all.status).toBe(204)
    expect(await db.session.count({ where: { userId: user.id, revokedAt: null } })).toBe(0)
  })
})

describe('password reset', () => {
  it('answers the same for known and unknown emails and only emails known ones', async () => {
    const user = await createUser()
    const known = await request(app).post(api('/forgot-password')).send({ email: user.email })
    const unknown = await request(app)
      .post(api('/forgot-password'))
      .send({ email: 'nobody@atk.test' })
    expect([known.status, known.body]).toEqual([unknown.status, unknown.body])

    await waitForEmail(user.email, 'reset-password')
    await sleep(200)
    expect((await emailJobs()).map((j) => j.data.to)).toEqual([user.email])
  })

  it('resets the password once, revokes sessions and clears lockout', async () => {
    const user = await createUser({
      failedLogins: 7,
      lockedUntil: new Date(Date.now() + 3_600_000),
    })
    await db.user.update({ where: { id: user.id }, data: { lockedUntil: null } })
    const rt = cookieValue(await login(user.email), 'atk_rt')
    await db.user.update({
      where: { id: user.id },
      data: { failedLogins: 7, lockedUntil: new Date(Date.now() + 3_600_000) },
    })

    await request(app).post(api('/forgot-password')).send({ email: user.email })
    const token = tokenFromUrl((await waitForEmail(user.email, 'reset-password')).data.url)

    const reset = await request(app)
      .post(api('/reset-password'))
      .send({ token, password: 'Brand-New-Pass-2' })
    expect(reset.status).toBe(200)
    expect((await refresh(rt)).status).toBe(401)

    const again = await request(app)
      .post(api('/reset-password'))
      .send({ token, password: 'Another-Pass-3' })
    expect(again.status).toBe(400)

    await flushRedis()
    expect((await login(user.email, PASSWORD)).status).toBe(401)
    await flushRedis()
    expect((await login(user.email, 'Brand-New-Pass-2')).status).toBe(200)
  })
})

describe('two-factor authentication for staff', () => {
  const codeAt = (secret, offsetSteps = 0) =>
    generate({ secret, epoch: Math.floor(Date.now() / 1000) + offsetSteps * 30 })

  it('requires TOTP setup on first login, then a code on every login', async () => {
    const admin = await createUser({ role: 'ADMIN' })

    const first = await login(admin.email)
    expect(first.status).toBe(200)
    expect(first.body.data).toEqual({ twoFactor: 'setup', challengeToken: expect.any(String) })
    expect(first.body.data.accessToken).toBeUndefined()
    expect(cookieHeader(first, 'atk_rt')).toBeUndefined()

    const { challengeToken } = first.body.data
    const setup = await request(app).post(api('/2fa/setup')).send({ challengeToken })
    expect(setup.status).toBe(200)
    expect(setup.body.data.otpauthUrl).toMatch(/^otpauth:\/\/totp\//)
    expect(setup.body.data.qrCode).toMatch(/^data:image\/png;base64,/)
    const { secret } = setup.body.data

    const stored = await db.user.findUnique({ where: { id: admin.id } })
    expect(stored.totpSecret).not.toContain(secret)
    expect(decryptSecret(stored.totpSecret)).toBe(secret)
    expect(stored.totpEnabled).toBe(false)

    const bad = await request(app).post(api('/2fa/enable')).send({ challengeToken, code: '000000' })
    expect(bad.status).toBe(401)
    expect(bad.body.error.code).toBe('INVALID_CODE')

    const enabled = await request(app)
      .post(api('/2fa/enable'))
      .send({ challengeToken, code: await codeAt(secret) })
    expect(enabled.status).toBe(200)
    expect(enabled.body.data.accessToken).toEqual(expect.any(String))
    expect(cookieValue(enabled, 'atk_rt')).toBeDefined()
    expect((await db.user.findUnique({ where: { id: admin.id } })).totpEnabled).toBe(true)

    await flushRedis()
    const next = await login(admin.email)
    expect(next.body.data.twoFactor).toBe('verify')

    const code = await codeAt(secret, 1)
    const verified = await request(app)
      .post(api('/2fa/verify'))
      .send({ challengeToken: next.body.data.challengeToken, code })
    expect(verified.status).toBe(200)
    expect(verified.body.data.user.role).toBe('ADMIN')

    // The same code cannot be replayed.
    const replay = await request(app)
      .post(api('/2fa/verify'))
      .send({ challengeToken: next.body.data.challengeToken, code })
    expect(replay.status).toBe(401)
  })

  it('rejects challenge tokens used for the wrong step and access tokens as challenges', async () => {
    const mod = await createUser({ role: 'MODERATOR' })
    const { challengeToken } = (await login(mod.email)).body.data
    const wrongStep = await request(app)
      .post(api('/2fa/verify'))
      .send({ challengeToken, code: '123456' })
    expect(wrongStep.status).toBe(401)
    expect(wrongStep.body.error.code).toBe('CHALLENGE_INVALID')

    const member = await createUser()
    const access = (await login(member.email)).body.data.accessToken
    const asChallenge = await request(app).post(api('/2fa/setup')).send({ challengeToken: access })
    expect(asChallenge.status).toBe(401)
  })

  it('counts wrong codes towards the lockout', async () => {
    const admin = await createUser({ role: 'SUPER_ADMIN' })
    const { challengeToken } = (await login(admin.email)).body.data
    await request(app).post(api('/2fa/setup')).send({ challengeToken })
    for (let i = 0; i < 5; i += 1) {
      await flushRedis()
      await request(app).post(api('/2fa/enable')).send({ challengeToken, code: '000000' })
    }
    await flushRedis()
    const locked = await request(app)
      .post(api('/2fa/enable'))
      .send({ challengeToken, code: '000000' })
    expect(locked.status).toBe(423)
  })
})
