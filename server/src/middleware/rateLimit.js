import { rateLimit } from 'express-rate-limit'
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
    keyGenerator,
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
