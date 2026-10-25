import { rateLimit, ipKeyGenerator } from 'express-rate-limit'
import { RedisStore } from 'rate-limit-redis'
import { redis, isRedisReady } from '../config/redis.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * rate-limit-redis loads its Lua scripts once in init(). If Redis is down at that moment the
 * rejected promise is cached and limits never recover, so reload the scripts on every reconnect.
 */
class ResilientRedisStore extends RedisStore {
  async init(options) {
    this.windowMs = options.windowMs
    const load = () => {
      this.incrementScriptSha = this.loadIncrementScript()
      this.getScriptSha = this.loadGetScript()
      // A failure surfaces on use and is let through by passOnStoreError.
      this.incrementScriptSha.catch(() => {})
      this.getScriptSha.catch(() => {})
    }
    if (isRedisReady()) load()
    redis.on('ready', load)
  }
}

/**
 * Redis-backed limiter (Part 6 §8). While Redis is down requests pass unlimited rather than
 * failing; passOnStoreError covers a connection that drops mid-request.
 */
export function createLimiter({ name, windowMs, limit, keyGenerator, skip = () => false }) {
  return rateLimit({
    windowMs,
    limit,
    ...(keyGenerator && { keyGenerator }),
    skip: (req, res) => !isRedisReady() || skip(req, res),
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    passOnStoreError: true,
    store: new ResilientRedisStore({
      prefix: `rl:${name}:`,
      sendCommand: (command, ...args) => redis.call(command, ...args),
    }),
    handler: (req, res, next) => next(ApiError.tooMany()),
  })
}

const MINUTE = 60 * 1000

// Everything else: 300 per 15 min per IP. /health is exempt so platform checks never hit 429.
export const globalLimiter = createLimiter({
  name: 'global',
  windowMs: 15 * MINUTE,
  limit: 300,
  skip: (req) => req.path === '/health',
})

const HOUR = 60 * MINUTE
const ip = (req) => ipKeyGenerator(req.ip)
const bodyEmail = (req) =>
  String(req.body?.email ?? '')
    .trim()
    .toLowerCase()

// Login: 5 per 15 min per IP + email; the account lockout grows beyond that (Part 6 §8).
export const loginLimiter = createLimiter({
  name: 'login',
  windowMs: 15 * MINUTE,
  limit: 5,
  keyGenerator: (req) => `${ip(req)}:${bodyEmail(req)}`,
})

// Second login step for staff: same budget, keyed by IP + challenge.
export const twoFactorLimiter = createLimiter({
  name: '2fa',
  windowMs: 15 * MINUTE,
  limit: 5,
  keyGenerator: (req) => `${ip(req)}:${String(req.body?.challengeToken ?? '').slice(-32)}`,
})

// Register, forgot password and other endpoints that send email: 5 per hour per IP.
export const registerLimiter = createLimiter({ name: 'register', windowMs: HOUR, limit: 5 })
export const emailLimiter = createLimiter({ name: 'email', windowMs: HOUR, limit: 5 })
export const reportLimiter = createLimiter({ name: 'reports', windowMs: HOUR, limit: 5 })
export const contactLimiter = createLimiter({ name: 'contact', windowMs: HOUR, limit: 5 })

// Search and suggest: 60 per minute per IP. Track: 120 per minute per IP.
export const searchLimiter = createLimiter({ name: 'search', windowMs: MINUTE, limit: 60 })
export const trackLimiter = createLimiter({ name: 'track', windowMs: MINUTE, limit: 120 })

// Submissions that create work for moderators (claims, reviews, events, market items):
// 10 per hour per account. Runs after verifyToken.
export const submissionLimiter = createLimiter({
  name: 'submissions',
  windowMs: HOUR,
  limit: 10,
  keyGenerator: (req) => `user:${req.user.id}`,
})
