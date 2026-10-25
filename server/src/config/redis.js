import { Redis } from 'ioredis'
import { env } from './env.js'
import { logger } from '../utils/logger.js'

const retryStrategy = (times) => Math.min(times * 200, 5000)

/**
 * Shared connection for cache and rate limits. Commands fail fast (500 ms, no offline queue)
 * so a Redis outage degrades to "no cache" instead of slowing every request.
 */
export const redis = new Redis(env.REDIS_URL, {
  connectTimeout: 2000,
  commandTimeout: 500,
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false,
  retryStrategy,
})

let lastError
redis.on('ready', () => {
  lastError = undefined
  logger.info('redis ready')
})
const describe = (err) => err.message || err.code || String(err)

redis.on('error', (err) => {
  // ioredis emits on every reconnect attempt; log each distinct failure once.
  if (describe(err) !== lastError) logger.warn(`redis error: ${describe(err)}`)
  lastError = describe(err)
})

export const isRedisReady = () => redis.status === 'ready'

/**
 * Waits briefly for the shared connection. A Redis outage at boot is not fatal: the API
 * serves without cache and ioredis keeps reconnecting in the background.
 */
export async function connectRedis(timeoutMs = 2000) {
  if (isRedisReady()) return
  const ready = await new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), timeoutMs)
    redis.once('ready', () => {
      clearTimeout(timer)
      resolve(true)
    })
  })
  if (!ready) logger.warn('redis unavailable at startup, continuing without cache')
}

/**
 * Dedicated connection for BullMQ. Workers block on Redis, so BullMQ requires
 * maxRetriesPerRequest: null. Producers (the API) fail fast instead of queueing offline.
 */
export function createQueueConnection({ worker = false } = {}) {
  const connection = new Redis(env.REDIS_URL, {
    maxRetriesPerRequest: worker ? null : 1,
    enableOfflineQueue: worker,
    retryStrategy,
  })
  connection.on('error', (err) => logger.warn(`queue redis error: ${describe(err)}`))
  return connection
}
