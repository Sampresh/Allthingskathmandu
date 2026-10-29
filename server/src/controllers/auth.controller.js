import bcrypt from 'bcryptjs'
import { OAuth2Client } from 'google-auth-library'
import { db } from '../config/db.js'
import { env } from '../config/env.js'
import { REFRESH_COOKIE, clearAuthCookies, setAuthCookies } from '../config/cookies.js'
import { isStaff } from '../middleware/requireRole.js'
import { clientUrl, queueEmail } from '../services/email.js'
import {
  consumeVerificationToken,
  createSession,
  createVerificationToken,
  revokeAllSessions,
  revokeByRefreshToken,
  rotateSession,
  signChallengeToken,
  verifyChallengeToken,
} from '../services/token.js'
import { createTotpSetup, verifyTotpCode } from '../services/totp.js'
import { verifyTurnstile } from '../services/turnstile.js'
import { ApiError } from '../utils/ApiError.js'
import { created, noContent, ok } from '../utils/ApiResponse.js'
import { logger } from '../utils/logger.js'

export const BCRYPT_COST = 12
const LOCK_THRESHOLD = 5
const BASE_LOCK_MS = 15 * 60 * 1000
const MAX_LOCK_MS = 24 * 60 * 60 * 1000
// Compared against when the email is unknown, so response time does not reveal accounts.
const DUMMY_HASH = '$2b$12$8PZcQlTPGhNfeAMMB5icN.qkeG.FhUx2.Udcr9lNWtIyjqXvQEuiK'

export const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  avatarUrl: user.avatarUrl,
  emailVerified: Boolean(user.emailVerifiedAt),
  totpEnabled: user.totpEnabled,
})

const clientInfo = (req) => ({ userAgent: req.get('user-agent'), ip: req.ip })

const invalidCredentials = () =>
  ApiError.unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS')
const invalidLink = () => new ApiError(400, 'TOKEN_INVALID', 'This link is invalid or has expired')

const findActiveUserByEmail = (email) => db.user.findFirst({ where: { email, deletedAt: null } })

async function issueSession(req, res, user, { mfa }) {
  const session = await createSession(user, { ...clientInfo(req), mfa })
  await db.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date(), failedLogins: 0, lockedUntil: null },
  })
  setAuthCookies(res, session.refreshToken, session.expiresAt)
  return { accessToken: session.accessToken, user: publicUser(user) }
}

// Staff (Moderator and above) must pass TOTP before any session exists.
function staffChallenge(user) {
  const step = user.totpEnabled ? 'verify' : 'setup'
  return { twoFactor: step, challengeToken: signChallengeToken(user.id, step) }
}

function assertCanSignIn(user) {
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60_000)
    throw new ApiError(
      423,
      'ACCOUNT_LOCKED',
      `Too many failed attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
    )
  }
}

function assertActive(user) {
  if (user.status !== 'ACTIVE') {
    throw ApiError.forbidden('This account is suspended', 'ACCOUNT_SUSPENDED')
  }
}

// Progressive lockout: from the 5th failure the lock doubles each time (15 min … 24 h).
async function recordFailure(user) {
  const { failedLogins } = await db.user.update({
    where: { id: user.id },
    data: { failedLogins: { increment: 1 } },
    select: { failedLogins: true },
  })
  if (failedLogins >= LOCK_THRESHOLD) {
    const lockMs = Math.min(BASE_LOCK_MS * 2 ** (failedLogins - LOCK_THRESHOLD), MAX_LOCK_MS)
    await db.user.update({
      where: { id: user.id },
      data: { lockedUntil: new Date(Date.now() + lockMs) },
    })
  }
}

// Runs after the response is sent so its duration does not reveal whether an account exists.
function afterResponse(task, label) {
  task().catch((err) => logger.error(`${label} failed: ${err.message}`))
}

// ---------- Registration and email verification ----------

export async function register(req, res) {
  const { name, email, password, turnstileToken } = req.body
  await verifyTurnstile(turnstileToken, req.ip)

  // Hash first on every path so timing is the same for new and existing emails.
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST)

  created(res, { message: 'Check your email to verify your account.' })

  afterResponse(async () => {
    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      if (!existing.deletedAt) {
        await queueEmail(existing.email, 'account-exists', {
          name: existing.name,
          loginUrl: clientUrl('/login'),
          resetUrl: clientUrl('/forgot-password'),
        })
      }
      return
    }
    const user = await db.user.create({ data: { name, email, passwordHash } })
    const token = await createVerificationToken(user.id, 'EMAIL_VERIFY')
    await queueEmail(user.email, 'verify-email', {
      name: user.name,
      url: clientUrl(`/verify-email?token=${token}`),
    })
  }, 'register')
}

export async function verifyEmail(req, res) {
  const userId = await consumeVerificationToken(req.body.token, 'EMAIL_VERIFY')
  if (!userId) throw invalidLink()
  await db.user.updateMany({
    where: { id: userId, emailVerifiedAt: null },
    data: { emailVerifiedAt: new Date() },
  })
  return ok(res, { verified: true })
}

export async function resendVerification(req, res) {
  ok(res, { message: 'If that account still needs verifying, we have sent a new link.' })

  afterResponse(async () => {
    const user = await findActiveUserByEmail(req.body.email)
    if (!user || user.emailVerifiedAt) return
    const token = await createVerificationToken(user.id, 'EMAIL_VERIFY')
    await queueEmail(user.email, 'verify-email', {
      name: user.name,
      url: clientUrl(`/verify-email?token=${token}`),
    })
  }, 'resend-verification')
}

// ---------- Login ----------

export async function login(req, res) {
  const { email, password } = req.body
  const user = await findActiveUserByEmail(email)

  if (!user || !user.passwordHash) {
    await bcrypt.compare(password, DUMMY_HASH)
    throw invalidCredentials()
  }
  assertCanSignIn(user)

  if (!(await bcrypt.compare(password, user.passwordHash))) {
    await recordFailure(user)
    throw invalidCredentials()
  }
  assertActive(user)
  if (!user.emailVerifiedAt) {
    throw ApiError.forbidden('Verify your email before logging in', 'EMAIL_NOT_VERIFIED')
  }

  if (isStaff(user.role) && env.STAFF_TWO_FACTOR) return ok(res, staffChallenge(user))
  return ok(res, await issueSession(req, res, user, { mfa: false }))
}

let googleClient

export async function google(req, res) {
  if (!env.GOOGLE_CLIENT_ID) throw ApiError.notFound('Google sign-in is not enabled')
  googleClient ??= new OAuth2Client(env.GOOGLE_CLIENT_ID)

  let payload
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: req.body.idToken,
      audience: env.GOOGLE_CLIENT_ID,
    })
    payload = ticket.getPayload()
  } catch {
    throw ApiError.unauthorized('Google sign-in failed', 'GOOGLE_INVALID')
  }
  if (!payload?.email || !payload.email_verified) {
    throw ApiError.unauthorized('Your Google email is not verified', 'GOOGLE_INVALID')
  }

  const email = payload.email.toLowerCase()
  let user = await db.user.findFirst({ where: { OR: [{ googleId: payload.sub }, { email }] } })
  if (user?.deletedAt) throw invalidCredentials()

  if (!user) {
    user = await db.user.create({
      data: {
        email,
        name: payload.name || email.split('@')[0],
        googleId: payload.sub,
        avatarUrl: payload.picture,
        emailVerifiedAt: new Date(),
      },
    })
  } else if (!user.googleId) {
    // Google has verified the address, so linking it to the existing account is safe.
    user = await db.user.update({
      where: { id: user.id },
      data: { googleId: payload.sub, emailVerifiedAt: user.emailVerifiedAt ?? new Date() },
    })
  }

  assertCanSignIn(user)
  assertActive(user)
  if (isStaff(user.role) && env.STAFF_TWO_FACTOR) return ok(res, staffChallenge(user))
  return ok(res, await issueSession(req, res, user, { mfa: false }))
}

// ---------- Sessions ----------

export async function refresh(req, res) {
  try {
    const result = await rotateSession(req.cookies[REFRESH_COOKIE], clientInfo(req))
    setAuthCookies(res, result.refreshToken, result.expiresAt)
    return ok(res, { accessToken: result.accessToken, user: publicUser(result.user) })
  } catch (err) {
    clearAuthCookies(res)
    throw err
  }
}

export async function logout(req, res) {
  await revokeByRefreshToken(req.cookies[REFRESH_COOKIE])
  clearAuthCookies(res)
  return noContent(res)
}

export async function logoutAll(req, res) {
  await revokeAllSessions(req.user.id)
  clearAuthCookies(res)
  return noContent(res)
}

// ---------- Password reset ----------

export async function forgotPassword(req, res) {
  ok(res, { message: 'If an account exists for that email, we have sent a reset link.' })

  afterResponse(async () => {
    const user = await findActiveUserByEmail(req.body.email)
    if (!user) return
    const token = await createVerificationToken(user.id, 'PASSWORD_RESET')
    await queueEmail(user.email, 'reset-password', {
      name: user.name,
      url: clientUrl(`/reset-password?token=${token}`),
    })
  }, 'forgot-password')
}

export async function resetPassword(req, res) {
  const userId = await consumeVerificationToken(req.body.token, 'PASSWORD_RESET')
  if (!userId) throw invalidLink()

  const user = await db.user.findUnique({ where: { id: userId } })
  await db.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(req.body.password, BCRYPT_COST),
      failedLogins: 0,
      lockedUntil: null,
      // Following the emailed link proves the address.
      emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
    },
  })
  await revokeAllSessions(userId)
  return ok(res, { message: 'Password updated. Log in with your new password.' })
}

// ---------- Two-factor authentication (Moderator and above) ----------

async function challengedStaffUser(challengeToken, step) {
  const userId = verifyChallengeToken(challengeToken, step)
  const user = await db.user.findFirst({ where: { id: userId, deletedAt: null } })
  if (!user || !isStaff(user.role)) throw ApiError.forbidden()
  assertCanSignIn(user)
  assertActive(user)
  return user
}

async function checkCode(user, code) {
  if (!(await verifyTotpCode(user.id, user.totpSecret, code))) {
    await recordFailure(user)
    throw ApiError.unauthorized('That code is not valid', 'INVALID_CODE')
  }
}

export async function setupTwoFactor(req, res) {
  const user = await challengedStaffUser(req.body.challengeToken, 'setup')
  if (user.totpEnabled) throw ApiError.conflict('Two-factor authentication is already enabled')

  const setup = await createTotpSetup(user.email)
  await db.user.update({ where: { id: user.id }, data: { totpSecret: setup.encrypted } })
  return ok(res, { otpauthUrl: setup.otpauthUrl, qrCode: setup.qrCode, secret: setup.secret })
}

export async function enableTwoFactor(req, res) {
  const user = await challengedStaffUser(req.body.challengeToken, 'setup')
  if (user.totpEnabled) throw ApiError.conflict('Two-factor authentication is already enabled')
  if (!user.totpSecret) throw ApiError.badRequest('Start two-factor setup first')

  await checkCode(user, req.body.code)
  const enabled = await db.user.update({ where: { id: user.id }, data: { totpEnabled: true } })
  return ok(res, await issueSession(req, res, enabled, { mfa: true }))
}

export async function verifyTwoFactor(req, res) {
  const user = await challengedStaffUser(req.body.challengeToken, 'verify')
  if (!user.totpEnabled || !user.totpSecret) throw ApiError.forbidden()

  await checkCode(user, req.body.code)
  return ok(res, await issueSession(req, res, user, { mfa: true }))
}
