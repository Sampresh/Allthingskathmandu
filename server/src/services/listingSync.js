import { db } from '../config/db.js'
import { Prisma } from '../generated/prisma/client'
import { purgeTags } from './cache.js'
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
 * search for "plumber" or "Thamel" finds listings) and profileScore (0 to 100, how complete
 * the listing is, used in ranking) current. The search trigger rebuilds searchVector.
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
        ), '') AS extra,
        (CASE WHEN b."logoUrl" IS NOT NULL THEN 15 ELSE 0 END
         + CASE WHEN b.description IS NOT NULL AND b.description <> '' THEN 15 ELSE 0 END
         + CASE WHEN COALESCE(b.phone, b.whatsapp, b."playStoreUrl", b."appStoreUrl") IS NOT NULL THEN 20 ELSE 0 END
         + CASE WHEN b.website IS NOT NULL THEN 10 ELSE 0 END
         + CASE WHEN b.hours IS NOT NULL AND b.hours <> 'null'::jsonb THEN 15 ELSE 0 END
         + CASE WHEN b.location IS NOT NULL THEN 15 ELSE 0 END
         + CASE WHEN b."areaId" IS NOT NULL THEN 10 ELSE 0 END) AS score
      FROM businesses b
      WHERE b."deletedAt" IS NULL ${only}
    )
    UPDATE businesses b
    SET "searchExtra" = computed.extra, "profileScore" = computed.score
    FROM computed
    WHERE b.id = computed.id
      AND (b."searchExtra" IS DISTINCT FROM computed.extra
           OR b."profileScore" IS DISTINCT FROM computed.score)
    RETURNING b.id`
  return { updated: updated.length }
}
