import pkg from '../../package.json' with { type: 'json' }
import { db } from '../config/db.js'
import { redis } from '../config/redis.js'

const DB_TIMEOUT_MS = 5000
const REDIS_TIMEOUT_MS = 500

function withTimeout(promise, ms) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timed out after ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

const check = (fn, ms) =>
  withTimeout(fn(), ms).then(
    () => true,
    () => false,
  )

// GET /health (Part 6 §9): 503 only when the database is down; Redis down is "degraded".
export async function health(req, res) {
  const [dbOk, redisOk] = await Promise.all([
    check(() => db.$queryRaw`SELECT 1`, DB_TIMEOUT_MS),
    check(() => redis.ping(), REDIS_TIMEOUT_MS),
  ])

  res.set('Cache-Control', 'no-store')
  res.status(dbOk ? 200 : 503).json({
    status: dbOk ? 'ok' : 'error',
    db: dbOk ? 'ok' : 'down',
    redis: redisOk ? 'ok' : 'degraded',
    version: pkg.version,
  })
}
