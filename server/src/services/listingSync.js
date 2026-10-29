import { db } from '../config/db.js'
import { Prisma } from '../generated/prisma/client'
import { purgeTags } from './cache.js'
import { refreshProfileScore } from './listings.js'
import { pageTagsFor, queueRevalidate } from './revalidate.js'

/**
 * Recomputes categories.liveCount: LIVE listings per category, per group (across its
 * categories) and LIVE items per market category. Purges cached pages whose counts changed.
 */
export async function refreshCategoryCounts() {
  const changed = await db.$queryRaw`
    WITH counts AS (
      SELECT c.id,
        CASE WHEN c.kind = 'MARKET' THEN (
          SELECT count(*) FROM market_items m
          WHERE m."categoryId" = c.id AND m.status = 'LIVE' AND m."deletedAt" IS NULL
        ) ELSE (
          SELECT count(DISTINCT b.id)
          FROM business_categories bc
          JOIN businesses b ON b.id = bc."businessId"
          WHERE b.status = 'LIVE' AND b."deletedAt" IS NULL
            AND (bc."categoryId" = c.id
                 OR bc."categoryId" IN (SELECT id FROM categories WHERE "parentId" = c.id))
        ) END::int AS live
      FROM categories c
    )
    UPDATE categories c SET "liveCount" = counts.live
    FROM counts
    WHERE c.id = counts.id AND c."liveCount" IS DISTINCT FROM counts.live
    RETURNING c.id, c.slug`

  if (changed.length) {
    await purgeTags(['groups', 'home', 'market', ...changed.map((c) => `category:${c.id}`)])
    // A category crossing the 5-listing threshold appears or disappears on public pages.
    await queueRevalidate(pageTagsFor({ categories: changed, extra: ['groups', 'home'] }))
  }
  return { changed: changed.length }
}

/**
 * Keeps businesses.searchExtra (category, group, tag and area names in both languages, so a
 * search for "plumber" or "Thamel" finds listings) current; the search trigger rebuilds
 * searchVector. Also recomputes profileScore, which saves set at once, so changes made outside
 * a listing save (owner hours or map pin, media) are counted too.
 */
export async function syncListings(businessIds) {
  const only = businessIds?.length
    ? Prisma.sql`AND b.id = ANY(${businessIds}::uuid[])`
    : Prisma.empty

  const updated = await db.$queryRaw`
    WITH computed AS (
      SELECT b.id,
        NULLIF(concat_ws(' ',
          (SELECT string_agg(DISTINCT concat_ws(' ', c."nameEn", c."nameNe", g."nameEn", g."nameNe"), ' ')
             FROM business_categories bc
             JOIN categories c ON c.id = bc."categoryId"
             LEFT JOIN categories g ON g.id = c."parentId"
             WHERE bc."businessId" = b.id),
          (SELECT string_agg(DISTINCT concat_ws(' ', t."nameEn", t."nameNe"), ' ')
             FROM business_tags bt JOIN tags t ON t.id = bt."tagId"
             WHERE bt."businessId" = b.id),
          (SELECT concat_ws(' ', a."nameEn", a."nameNe") FROM areas a WHERE a.id = b."areaId")
        ), '') AS extra
      FROM businesses b
      WHERE b."deletedAt" IS NULL ${only}
    )
    UPDATE businesses b
    SET "searchExtra" = computed.extra
    FROM computed
    WHERE b.id = computed.id AND b."searchExtra" IS DISTINCT FROM computed.extra
    RETURNING b.id`

  const ids = businessIds?.length
    ? businessIds
    : (await db.business.findMany({ where: { deletedAt: null }, select: { id: true } })).map(
        (b) => b.id,
      )
  for (const id of ids) {
    const exists = await db.business.findUnique({ where: { id }, select: { id: true } })
    if (exists) await refreshProfileScore(db, id)
  }
  return { updated: updated.length, scored: ids.length }
}
