import { db } from '../config/db.js'
import { verifyAccessToken } from '../services/token.js'
import { ApiError } from '../utils/ApiError.js'

// Fields every protected route can rely on in req.user.
const USER_FIELDS = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  avatarUrl: true,
  emailVerifiedAt: true,
  totpEnabled: true,
  deletedAt: true,
}

function bearer(req) {
  const header = req.get('authorization')
  return header?.startsWith('Bearer ') ? header.slice(7).trim() : null
}

async function authenticate(token) {
  const payload = verifyAccessToken(token)
  // Re-read the session and user on every request: revoked sessions, suspensions and role
  // changes take effect immediately instead of when the token expires.
  const session = await db.session.findUnique({
    where: { id: payload.sid },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      expiresAt: true,
      user: { select: USER_FIELDS },
    },
  })
  if (
    !session ||
    session.userId !== payload.sub ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  ) {
    throw ApiError.unauthorized('Session expired, please log in', 'SESSION_REVOKED')
  }
  const { user } = session
  if (user.deletedAt || user.status !== 'ACTIVE') {
    throw ApiError.unauthorized('Account unavailable', 'ACCOUNT_UNAVAILABLE')
  }
  return { user, auth: { sessionId: session.id, mfa: payload.mfa === true } }
}

/** Requires a valid access token. Sets req.user and req.auth ({ sessionId, mfa }). */
export async function verifyToken(req, res, next) {
  const token = bearer(req)
  if (!token) throw ApiError.unauthorized()
  Object.assign(req, await authenticate(token))
  next()
}

/** Attaches req.user when a valid token is sent; anonymous requests pass through. */
export async function optionalAuth(req, res, next) {
  const token = bearer(req)
  if (token) {
    try {
      Object.assign(req, await authenticate(token))
    } catch {
      // An invalid token on a public route is treated as anonymous.
    }
  }
  next()
}
