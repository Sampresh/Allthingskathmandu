import { isRedisReady, redis } from '../config/redis.js'
import { logger } from '../utils/logger.js'

const KEY_PREFIX = 'cache:'
const TAG_PREFIX = 'cachetag:'
// Tag sets outlive the longest cache TTL (60 min) so a purge always finds its keys.
const TAG_TTL_S = 2 * 60 * 60

/** Cached string for `key`, or null. A Redis failure is a miss, never an error. */
export async function getCached(key) {
  if (!isRedisReady()) return null
  try {
    return await redis.get(KEY_PREFIX + key)
  } catch {
    return null
  }
}

/** Stores `value` for `ttlSeconds` and records the key under each tag. */
export async function setCached(key, value, ttlSeconds, tags = []) {
  if (!isRedisReady()) return
  try {
    const tx = redis.multi().set(KEY_PREFIX + key, value, 'EX', ttlSeconds)
    for (const tag of tags) tx.sadd(TAG_PREFIX + tag, key).expire(TAG_PREFIX + tag, TAG_TTL_S)
    await tx.exec()
  } catch (err) {
    logger.debug(`cache set skipped: ${err.message}`)
  }
}

/** Deletes every cached response recorded under these tags. */
export async function purgeTags(tags) {
  let purged = 0
  for (const tag of new Set(tags)) {
    const keys = await redis.smembers(TAG_PREFIX + tag)
    if (keys.length) purged += await redis.del(...keys.map((k) => KEY_PREFIX + k))
    await redis.del(TAG_PREFIX + tag)
  }
  return purged
}

/** Deletes the whole response cache. */
export async function purgeAll() {
  let purged = 0
  for (const pattern of [`${KEY_PREFIX}*`, `${TAG_PREFIX}*`]) {
    let cursor = '0'
    do {
      const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 500)
      cursor = next
      if (keys.length) purged += await redis.del(...keys)
    } while (cursor !== '0')
  }
  return purged
}
