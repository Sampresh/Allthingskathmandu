import { db } from '../config/db.js'
import { isRedisReady, redis } from '../config/redis.js'
import { Prisma } from '../generated/prisma/client'
import { nepalClock } from '../lib/hours.js'
import { TRACK_FIELDS } from '../lib/track.js'
import { logger } from '../utils/logger.js'

export { TRACK_FIELDS }

const PENDING = 'stats:pending'
const KEY_TTL_S = 7 * 24 * 60 * 60
const VIEW_DEDUPE_S = 30 * 60
const FLUSH_BATCH = 500

// Reads a counter hash and deletes it in one step, so increments are never lost or doubled.
redis.defineCommand('hgetallDel', {
  numberOfKeys: 1,
  lua: "local v = redis.call('HGETALL', KEYS[1]); redis.call('DEL', KEYS[1]); return v",
})

const counterKey = (date, businessId) => `stats:${date}:${businessId}`

/**
 * Counts a view or click in Redis (never a database row per event). A visitor's repeat
 * views of the same listing within 30 minutes count once. Dates are Nepal Time.
 */
export async function trackEvent({ businessId, kind, visitor }) {
  if (!isRedisReady()) return
  try {
    if (kind === 'view') {
      const first = await redis.set(
        `stats:seen:${visitor}:${businessId}`,
        '1',
        'EX',
        VIEW_DEDUPE_S,
        'NX',
      )
      if (!first) return
    }
    const key = counterKey(nepalClock().date, businessId)
    await redis
      .multi()
      .hincrby(key, TRACK_FIELDS[kind], 1)
      .expire(key, KEY_TTL_S)
      .sadd(PENDING, key)
      .exec()
  } catch (err) {
    logger.debug(`track skipped: ${err.message}`)
  }
}

const COLUMNS = Object.values(TRACK_FIELDS)

function toRow(key, flat) {
  const [, date, businessId] = key.split(':')
  const counts = Object.fromEntries(COLUMNS.map((c) => [c, 0]))
  for (let i = 0; i < flat.length; i += 2) {
    if (flat[i] in counts) counts[flat[i]] = Number(flat[i + 1]) || 0
  }
  return { businessId, date, ...counts }
}

async function restore(rows) {
  const tx = redis.multi()
  for (const row of rows) {
    const key = counterKey(row.date, row.businessId)
    for (const column of COLUMNS) if (row[column]) tx.hincrby(key, column, row[column])
    tx.expire(key, KEY_TTL_S).sadd(PENDING, key)
  }
  await tx.exec()
}

async function writeRows(rows) {
  const values = rows.map(
    (r) =>
      Prisma.sql`(${r.businessId}::uuid, ${r.date}::date, ${r.views}::int, ${r.calls}::int,
        ${r.whatsapp}::int, ${r.mapClicks}::int, ${r.websiteClicks}::int)`,
  )
  // The join drops counts for ids that are not listings (track accepts any UUID).
  await db.$executeRaw`
    INSERT INTO listing_stats_daily
      ("businessId", date, views, calls, whatsapp, "mapClicks", "websiteClicks")
    SELECT v.id, v.day, v.views, v.calls, v.whatsapp, v.map, v.website
    FROM (VALUES ${Prisma.join(values)}) AS v(id, day, views, calls, whatsapp, map, website)
    JOIN businesses b ON b.id = v.id
    ON CONFLICT ("businessId", date) DO UPDATE SET
      views = listing_stats_daily.views + EXCLUDED.views,
      calls = listing_stats_daily.calls + EXCLUDED.calls,
      whatsapp = listing_stats_daily.whatsapp + EXCLUDED.whatsapp,
      "mapClicks" = listing_stats_daily."mapClicks" + EXCLUDED."mapClicks",
      "websiteClicks" = listing_stats_daily."websiteClicks" + EXCLUDED."websiteClicks"`
}

/** Moves Redis counters into listing_stats_daily (worker, every 5 minutes). */
export async function flushStats() {
  let flushed = 0
  for (;;) {
    const keys = await redis.spop(PENDING, FLUSH_BATCH)
    if (!keys.length) break

    const rows = []
    for (const key of keys) {
      const flat = await redis.hgetallDel(key)
      if (flat.length) rows.push(toRow(key, flat))
    }
    if (!rows.length) continue

    try {
      await writeRows(rows)
    } catch (err) {
      await restore(rows) // put the counts back so the next run retries them
      throw err
    }
    flushed += rows.length
  }
  return { flushed }
}
