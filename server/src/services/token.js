import { createHash, randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { db } from '../config/db.js'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { logger } from '../utils/logger.js'

const ALGORITHM = 'HS256'
const ISSUER = 'atk-api'
const AUDIENCE = 'atk'
const CHALLENGE_EXPIRY = '10m'

const signOptions = { algorithm: ALGORITHM, issuer: ISSUER, audience: AUDIENCE }
const verifyOptions = { algorithms: [ALGORITHM], issuer: ISSUER, audience: AUDIENCE }

export const hashToken = (raw) => createHash('sha256').update(raw).digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')

// ---------- Access tokens (15 min, kept in memory by the client) ----------

export function signAccessToken(user, { sessionId, mfa }) {
  return jwt.sign({ typ: 'access', role: user.role, sid: sessionId, mfa }, env.JWT_ACCESS_SECRET, {
    ...signOptions,
    subject: user.id,
    expiresIn: env.JWT_ACCESS_EXPIRY,
  })
}

/** Returns the payload or throws an ApiError (401). */
export function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, verifyOptions)
    if (payload.typ !== 'access') throw new Error('wrong token type')
    return payload
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw ApiError.unauthorized('Access token expired', 'TOKEN_EXPIRED')
    }
    throw ApiError.unauthorized('Invalid access token', 'TOKEN_INVALID')
  }
}

// ---------- 2FA challenge tokens (between password and TOTP steps) ----------

export function signChallengeToken(userId, purpose) {
  return jwt.sign({ typ: 'challenge', purpose }, env.JWT_ACCESS_SECRET, {
    ...signOptions,
    subject: userId,
    expiresIn: CHALLENGE_EXPIRY,
  })
}

export function verifyChallengeToken(token, purpose) {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, verifyOptions)
    if (payload.typ !== 'challenge' || payload.purpose !== purpose) throw new Error('wrong token')
    return payload.sub
  } catch {
    throw ApiError.unauthorized('Sign-in step expired, please log in again', 'CHALLENGE_INVALID')
  }
}

// ---------- Sessions with rotating refresh tokens ----------

function signRefreshToken(userId, sessionId, mfa) {
  return jwt.sign({ typ: 'refresh', sid: sessionId, mfa }, env.JWT_REFRESH_SECRET, {
    ...signOptions,
    subject: userId,
    jwtid: randomToken(),
    expiresIn: env.JWT_REFRESH_EXPIRY,
  })
}

function decodeRefreshToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_REFRESH_SECRET, verifyOptions)
    if (payload.typ !== 'refresh') throw new Error('wrong token type')
    return payload
  } catch {
    return null
  }
}

const expiryOf = (token) => new Date(jwt.decode(token).exp * 1000)

/** Creates a session and returns { session, refreshToken, accessToken, expiresAt }. */
export async function createSession(user, { userAgent, ip, mfa = false }) {
  return db.$transaction(async (tx) => {
    // The token embeds the session id, so insert first with a throwaway hash.
    const session = await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(randomToken()),
        userAgent: userAgent?.slice(0, 255),
        ip,
        expiresAt: new Date(),
      },
    })
    const refreshToken = signRefreshToken(user.id, session.id, mfa)
    const expiresAt = expiryOf(refreshToken)
    await tx.session.update({
      where: { id: session.id },
      data: { tokenHash: hashToken(refreshToken), expiresAt },
    })
    return {
      session,
      refreshToken,
      expiresAt,
      accessToken: signAccessToken(user, { sessionId: session.id, mfa }),
    }
  })
}

/**
 * Exchanges a refresh token for a new pair. A token that verifies but is no longer the
 * session's current one has been used before: treat it as stolen and revoke every session.
 */
export async function rotateSession(refreshToken, { userAgent, ip }) {
  const payload = refreshToken ? decodeRefreshToken(refreshToken) : null
  if (!payload) throw ApiError.unauthorized('Session expired, please log in', 'REFRESH_INVALID')

  const session = await db.session.findUnique({
    where: { id: payload.sid },
    include: { user: true },
  })
  const now = new Date()
  if (!session || session.userId !== payload.sub || session.revokedAt || session.expiresAt <= now) {
    throw ApiError.unauthorized('Session expired, please log in', 'REFRESH_INVALID')
  }

  const presentedHash = hashToken(refreshToken)
  const nextToken = signRefreshToken(session.userId, session.id, payload.mfa === true)
  const expiresAt = expiryOf(nextToken)

  // Conditional update: only the holder of the current token can rotate it.
  const { count } =
    presentedHash === session.tokenHash
      ? await db.session.updateMany({
          where: { id: session.id, tokenHash: presentedHash, revokedAt: null },
          data: {
            tokenHash: hashToken(nextToken),
            expiresAt,
            userAgent: userAgent?.slice(0, 255),
            ip,
          },
        })
      : { count: 0 }

  if (count === 0) {
    await revokeAllSessions(session.userId)
    logger.warn(`refresh token reuse detected for user ${session.userId}; all sessions revoked`)
    throw ApiError.unauthorized('Session expired, please log in', 'REFRESH_REUSED')
  }

  const { user } = session
  if (user.deletedAt || user.status !== 'ACTIVE') {
    await revokeSession(session.id)
    throw ApiError.unauthorized('Session expired, please log in', 'REFRESH_INVALID')
  }

  return {
    user,
    refreshToken: nextToken,
    expiresAt,
    accessToken: signAccessToken(user, { sessionId: session.id, mfa: payload.mfa === true }),
  }
}

/** Revokes the session a refresh token belongs to, if it is valid. Used by logout. */
export async function revokeByRefreshToken(refreshToken) {
  const payload = refreshToken ? decodeRefreshToken(refreshToken) : null
  if (payload) await revokeSession(payload.sid)
}

export function revokeSession(sessionId) {
  return db.session.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

export function revokeAllSessions(userId, { exceptSessionId } = {}) {
  return db.session.updateMany({
    where: { userId, revokedAt: null, ...(exceptSessionId && { id: { not: exceptSessionId } }) },
    data: { revokedAt: new Date() },
  })
}

// ---------- Single-use email tokens (verification, password reset) ----------

const TOKEN_TTL_MS = {
  EMAIL_VERIFY: 24 * 60 * 60 * 1000,
  PASSWORD_RESET: 60 * 60 * 1000,
}

/** Creates a token, invalidating earlier unused ones of the same type. Returns the raw token. */
export async function createVerificationToken(userId, type) {
  const raw = randomToken()
  await db.$transaction([
    db.verificationToken.updateMany({
      where: { userId, type, usedAt: null },
      data: { usedAt: new Date() },
    }),
    db.verificationToken.create({
      data: {
        userId,
        type,
        tokenHash: hashToken(raw),
        expiresAt: new Date(Date.now() + TOKEN_TTL_MS[type]),
      },
    }),
  ])
  return raw
}

/** Marks a token used and returns its userId, or null if unknown, used or expired. */
export async function consumeVerificationToken(raw, type) {
  const tokenHash = hashToken(raw)
  const { count } = await db.verificationToken.updateMany({
    where: { tokenHash, type, usedAt: null, expiresAt: { gt: new Date() } },
    data: { usedAt: new Date() },
  })
  if (count === 0) return null
  const token = await db.verificationToken.findUnique({ where: { tokenHash } })
  return token.userId
}
