import { isRedisReady } from '../config/redis.js'
import { getCached, setCached } from '../services/cache.js'

// Same query in any parameter order → same cache entry.
function cacheKey(req) {
  const url = new URL(req.originalUrl, 'http://cache.local')
  url.searchParams.sort()
  return `${url.pathname}?${url.searchParams}`
}

/**
 * Redis cache for public GETs (TTL + delete on write via tags). `tags(req, body)` returns the
 * tags to file the response under; `skip(req)` bypasses caching (e.g. per-visitor locations).
 * If Redis is down the request simply goes to the database.
 */
export function cache({ ttl, tags = () => [], skip = () => false }) {
  return async (req, res, next) => {
    if (req.method !== 'GET' || skip(req) || !isRedisReady()) return next()

    const key = cacheKey(req)
    const hit = await getCached(key)
    if (hit) {
      res.set('X-Cache', 'HIT')
      return res.type('application/json').send(hit)
    }

    res.set('X-Cache', 'MISS')
    const json = res.json.bind(res)
    res.json = (body) => {
      if (res.statusCode === 200 && body?.success) {
        setCached(key, JSON.stringify(body), ttl, tags(req, body))
      }
      return json(body)
    }
    next()
  }
}
