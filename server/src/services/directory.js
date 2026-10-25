import { z } from 'zod'
import { readDb } from '../config/db.js'
import { Prisma } from '../generated/prisma/client'
import { decodeCursor, encodeCursor, keysetSchema } from '../lib/cursor.js'
import { isOpenAt, nepalClock, openNowSql } from '../lib/hours.js'

// A category is public only with this many LIVE listings (Part 3 §8).
export const MIN_LIVE_LISTINGS = 5
// At most this many Featured cards per results page, always labelled (Part 3 §8).
export const FEATURED_SLOTS = 2
// Sort key for listings without a map pin when sorting by distance: they go last.
const NO_LOCATION = 1e12

export const liveSql = Prisma.sql`b.status = 'LIVE' AND b."deletedAt" IS NULL`
export const featuredSql = Prisma.sql`COALESCE(b."featuredUntil" > now(), false)`

export const distanceSql = (point) =>
  point
    ? Prisma.sql`ST_Distance(b.location, ST_MakePoint(${point.lng}, ${point.lat})::geography)`
    : Prisma.sql`NULL::float8`

const cardColumns = (point) => Prisma.sql`
  b.id, b.slug, b.name, b."nameNe", b.type, b."shortDesc", b."logoUrl",
  b.phone, b.whatsapp, b.website, b."playStoreUrl", b."appStoreUrl",
  b."priceLevel", b."ratingAvg"::float8 AS "ratingAvg", b."ratingCount", b."isVerified", b.hours,
  ${featuredSql} AS featured,
  a.slug AS "areaSlug", a."nameEn" AS "areaNameEn", a."nameNe" AS "areaNameNe",
  pc.slug AS "categorySlug", pc."nameEn" AS "categoryNameEn", pc."nameNe" AS "categoryNameNe",
  pc."groupSlug",
  ${distanceSql(point)} AS meters`

// Area and primary category for each card.
const cardJoins = Prisma.sql`
  LEFT JOIN areas a ON a.id = b."areaId"
  LEFT JOIN LATERAL (
    SELECT c.slug, c."nameEn", c."nameNe", g.slug AS "groupSlug"
    FROM business_categories bc
    JOIN categories c ON c.id = bc."categoryId"
    LEFT JOIN categories g ON g.id = c."parentId"
    WHERE bc."businessId" = b.id
    ORDER BY bc."isPrimary" DESC, c."sortOrder"
    LIMIT 1
  ) pc ON true`

/** Public card shape (Part 4 §4). */
export function toCard(row, clock = nepalClock()) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    nameNe: row.nameNe,
    type: row.type,
    shortDesc: row.shortDesc,
    logoUrl: row.logoUrl,
    contact: {
      phone: row.phone,
      whatsapp: row.whatsapp,
      website: row.website,
      playStoreUrl: row.playStoreUrl,
      appStoreUrl: row.appStoreUrl,
    },
    priceLevel: row.priceLevel,
    rating: { average: Number(row.ratingAvg), count: row.ratingCount },
    isVerified: row.isVerified,
    featured: row.featured,
    openNow: isOpenAt(row.hours, clock),
    area: row.areaSlug
      ? { slug: row.areaSlug, nameEn: row.areaNameEn, nameNe: row.areaNameNe }
      : null,
    category: row.categorySlug
      ? {
          slug: row.categorySlug,
          nameEn: row.categoryNameEn,
          nameNe: row.categoryNameNe,
          groupSlug: row.groupSlug,
        }
      : null,
    distanceMeters: row.meters == null ? null : Math.round(row.meters),
  }
}

/**
 * One keyset-paginated stream of cards ordered by (sortKey, id). `after` is the last
 * [sortKey, id] already returned. No OFFSET anywhere.
 */
export function cardStream({ point, where, sortKey, from = Prisma.empty, after, limit }) {
  return readDb.$queryRaw`
    SELECT * FROM (
      SELECT ${cardColumns(point)}, (${sortKey})::float8 AS "sortKey"
      FROM businesses b
      ${cardJoins}
      ${from}
      WHERE ${where}
    ) s
    WHERE ${after ? Prisma.sql`("sortKey", id) > (${after[0]}::float8, ${after[1]}::uuid)` : Prisma.sql`TRUE`}
    ORDER BY "sortKey", id
    LIMIT ${limit}`
}

const slottedCursor = z.object({
  f: keysetSchema.nullable(),
  o: keysetSchema.nullable(),
  fd: z.boolean(),
  od: z.boolean(),
})

/**
 * Results page with up to FEATURED_SLOTS Featured cards on top and organic results below.
 * Featured and organic listings are separate streams, each with its own keyset in the
 * cursor. When organic results run out, Featured ones may fill the rest of the page.
 */
export async function slottedPage({ point, where, from, organicKey, featuredKey, cursor, limit }) {
  const state = decodeCursor(cursor, slottedCursor) ?? { f: null, o: null, fd: false, od: false }

  const [featured, organic] = await Promise.all([
    state.fd
      ? []
      : cardStream({
          point,
          from,
          where: Prisma.sql`${where} AND ${featuredSql}`,
          sortKey: featuredKey,
          after: state.f,
          limit: limit + 1,
        }),
    state.od
      ? []
      : cardStream({
          point,
          from,
          where: Prisma.sql`${where} AND NOT ${featuredSql}`,
          sortKey: organicKey,
          after: state.o,
          limit: limit + 1,
        }),
  ])

  let featuredTake = Math.min(FEATURED_SLOTS, featured.length, limit)
  const organicExhausted = organic.length <= limit - featuredTake
  if (organicExhausted) featuredTake = Math.min(featured.length, limit - organic.length)
  const organicTake = Math.min(limit - featuredTake, organic.length)

  const featuredRows = featured.slice(0, featuredTake)
  const organicRows = organic.slice(0, organicTake)
  const fd = state.fd || featured.length <= featuredTake
  const od = state.od || organic.length <= organicTake
  const lastKey = (rows, previous) =>
    rows.length ? [rows.at(-1).sortKey, rows.at(-1).id] : previous

  const clock = nepalClock()
  return {
    items: [...featuredRows, ...organicRows].map((row) => toCard(row, clock)),
    nextCursor:
      fd && od
        ? null
        : encodeCursor({
            f: lastKey(featuredRows, state.f),
            o: lastKey(organicRows, state.o),
            fd,
            od,
          }),
  }
}

// Featured order rotates every hour so paid placements share the top slots fairly.
const rotationSql = () => {
  const seed = new Date().toISOString().slice(0, 13)
  return Prisma.sql`('x' || substr(md5(b.id::text || ${seed}::text), 1, 8))::bit(32)::int`
}

/** Organic order: nearest first when the visitor's location is known, else most complete. */
export const organicSortSql = (point) =>
  point
    ? Prisma.sql`COALESCE(${distanceSql(point)}, ${NO_LOCATION})`
    : Prisma.sql`-b."profileScore"`

export const featuredSortSql = (point) =>
  point ? Prisma.sql`COALESCE(${distanceSql(point)}, ${NO_LOCATION})` : rotationSql()

// ---------- Filters ----------

/** Apps and hotlines serve the whole valley, so an area filter keeps them. */
export const areaSql = (areaId) =>
  Prisma.sql`(b."areaId" = ${areaId}::uuid OR (b."areaId" IS NULL AND b.type IN ('APP', 'HOTLINE')))`

export const inCategoriesSql = (categoryIds) => Prisma.sql`EXISTS (
  SELECT 1 FROM business_categories bc
  WHERE bc."businessId" = b.id AND bc."categoryId" = ANY(${categoryIds}::uuid[]))`

/** SQL condition for the listing filters; unknown area or tag slugs match nothing. */
export async function filtersSql({ area, tags = [], open, price = [], rating }) {
  const conditions = [liveSql]

  if (area) {
    const found = await readDb.area.findFirst({ where: { slug: area, isVisible: true } })
    conditions.push(found ? areaSql(found.id) : Prisma.sql`FALSE`)
  }
  if (tags.length) {
    const found = await readDb.tag.findMany({ where: { slug: { in: tags } }, select: { id: true } })
    if (found.length !== new Set(tags).size) conditions.push(Prisma.sql`FALSE`)
    for (const { id } of found) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM business_tags bt WHERE bt."businessId" = b.id AND bt."tagId" = ${id}::uuid)`)
    }
  }
  if (open) conditions.push(openNowSql())
  if (price.length) conditions.push(Prisma.sql`b."priceLevel" = ANY(${price}::int[])`)
  if (rating) conditions.push(Prisma.sql`b."ratingAvg" >= ${rating}`)

  return Prisma.join(conditions, ' AND ')
}

// ---------- Taxonomy ----------

const visibleChildren = {
  where: { isVisible: true, liveCount: { gte: MIN_LIVE_LISTINGS } },
  orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
}

const categoryOut = (c) => ({
  id: c.id,
  slug: c.slug,
  nameEn: c.nameEn,
  nameNe: c.nameNe,
  icon: c.icon,
  liveCount: c.liveCount,
})

/** Visible groups, each with its visible categories and live counts. */
export async function getCategoryTree() {
  const groups = await readDb.category.findMany({
    where: { kind: 'DIRECTORY', parentId: null, isVisible: true },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    include: { children: visibleChildren },
  })
  return groups
    .filter((g) => g.children.length)
    .map((g) => ({ ...categoryOut(g), categories: g.children.map(categoryOut) }))
}

/**
 * A public category (or group) by slug, with its parent group, filter tags and, for a group,
 * its visible categories. Null when hidden or below the live-listing threshold.
 */
export async function getCategory(slug) {
  const category = await readDb.category.findFirst({
    where: { slug, kind: 'DIRECTORY', isVisible: true },
    include: {
      parent: true,
      children: visibleChildren,
      tags: { orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }] },
    },
  })
  if (!category) return null

  const isGroup = !category.parentId
  if (isGroup ? !category.children.length : category.liveCount < MIN_LIVE_LISTINGS) return null
  if (!isGroup && !category.parent.isVisible) return null

  return {
    ...categoryOut(category),
    description: category.description,
    seoTitle: category.seoTitle,
    seoDescription: category.seoDescription,
    isGroup,
    group: isGroup ? null : categoryOut(category.parent),
    categories: category.children.map(categoryOut),
    tags: category.tags.map((t) => ({ slug: t.slug, nameEn: t.nameEn, nameNe: t.nameNe })),
  }
}

/** Ids a category page covers: the category itself, or every category of a group. */
export const categoryIdsOf = (category) =>
  category.isGroup ? category.categories.map((c) => c.id) : [category.id]

export async function listCategoryListings(category, filters, { point, cursor, limit }) {
  const where = Prisma.sql`${inCategoriesSql(categoryIdsOf(category))} AND ${await filtersSql(filters)}`
  return slottedPage({
    point,
    where,
    organicKey: organicSortSql(point),
    featuredKey: featuredSortSql(point),
    cursor,
    limit,
  })
}

// ---------- Listing detail ----------

export async function getListing(slug) {
  const listing = await readDb.business.findFirst({
    where: { slug, status: 'LIVE', deletedAt: null },
    include: {
      area: true,
      categories: {
        include: { category: { include: { parent: true } } },
        orderBy: { isPrimary: 'desc' },
      },
      tags: { include: { tag: true } },
    },
  })
  if (!listing) return null

  const now = new Date()
  const featured = Boolean(listing.featuredUntil && listing.featuredUntil > now)
  const [[location], media, offers] = await Promise.all([
    readDb.$queryRaw`
      SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
      FROM businesses WHERE id = ${listing.id}::uuid AND location IS NOT NULL`,
    // Photos, videos and offers are Featured-only (Part 1 §2).
    featured
      ? readDb.media.findMany({ where: { businessId: listing.id }, orderBy: { sortOrder: 'asc' } })
      : [],
    featured
      ? readDb.offer.findMany({
          where: {
            businessId: listing.id,
            isActive: true,
            startsAt: { lte: now },
            endsAt: { gt: now },
          },
          orderBy: { endsAt: 'asc' },
        })
      : [],
  ])

  const primary = listing.categories[0]?.category
  return {
    id: listing.id,
    slug: listing.slug,
    name: listing.name,
    nameNe: listing.nameNe,
    type: listing.type,
    shortDesc: listing.shortDesc,
    description: listing.description,
    logoUrl: listing.logoUrl,
    contact: {
      phone: listing.phone,
      whatsapp: listing.whatsapp,
      email: listing.email,
      website: listing.website,
      playStoreUrl: listing.playStoreUrl,
      appStoreUrl: listing.appStoreUrl,
    },
    address: listing.address,
    area: listing.area
      ? { slug: listing.area.slug, nameEn: listing.area.nameEn, nameNe: listing.area.nameNe }
      : null,
    location: location ? { lat: location.lat, lng: location.lng } : null,
    hours: listing.hours,
    openNow: isOpenAt(listing.hours),
    priceLevel: listing.priceLevel,
    rating: { average: Number(listing.ratingAvg), count: listing.ratingCount },
    isVerified: listing.isVerified,
    featured,
    category: primary
      ? {
          id: primary.id,
          slug: primary.slug,
          nameEn: primary.nameEn,
          nameNe: primary.nameNe,
          groupSlug: primary.parent?.slug ?? null,
        }
      : null,
    categories: listing.categories.map(({ category: c, isPrimary }) => ({
      slug: c.slug,
      nameEn: c.nameEn,
      nameNe: c.nameNe,
      isPrimary,
      groupSlug: c.parent?.slug ?? null,
    })),
    tags: listing.tags.map(({ tag }) => ({
      slug: tag.slug,
      nameEn: tag.nameEn,
      nameNe: tag.nameNe,
    })),
    media: media.map((m) => ({ id: m.id, type: m.type, url: m.url, altText: m.altText })),
    offers: offers.map((o) => ({
      id: o.id,
      title: o.title,
      body: o.body,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
    })),
    seoTitle: listing.seoTitle,
    seoDescription: listing.seoDescription,
    updatedAt: listing.updatedAt,
  }
}

const reviewCursor = z.tuple([z.iso.datetime(), z.uuid()])

/** Approved reviews, newest first, keyset on (createdAt, id). */
export async function listReviews(businessId, { cursor, limit }) {
  const after = decodeCursor(cursor, reviewCursor)
  const rows = await readDb.review.findMany({
    where: {
      businessId,
      status: 'APPROVED',
      ...(after && {
        OR: [
          { createdAt: { lt: new Date(after[0]) } },
          { createdAt: new Date(after[0]), id: { lt: after[1] } },
        ],
      }),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { user: { select: { name: true, avatarUrl: true, deletedAt: true } } },
  })
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    items: page.map((r) => ({
      id: r.id,
      rating: r.rating,
      body: r.body,
      createdAt: r.createdAt,
      // First name only on public pages.
      author: r.user.deletedAt
        ? { name: null, avatarUrl: null }
        : { name: r.user.name.split(/\s+/)[0], avatarUrl: r.user.avatarUrl },
    })),
    nextCursor: rows.length > limit ? encodeCursor([last.createdAt.toISOString(), last.id]) : null,
  }
}

/** Other LIVE listings in the same category, nearest to this one when it has a pin. */
export async function listSimilar(listing, limit) {
  if (!listing.category) return []
  const point = listing.location
  const rows = await cardStream({
    point,
    where: Prisma.sql`${liveSql} AND b.id <> ${listing.id}::uuid AND ${inCategoriesSql([listing.category.id])}`,
    sortKey: organicSortSql(point),
    limit,
  })
  const clock = nepalClock()
  return rows.map((row) => toCard(row, clock))
}

// ---------- Areas, plans, settings ----------

export function listAreas() {
  return readDb.$queryRaw`
    SELECT slug, "nameEn", "nameNe", district,
           ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng
    FROM areas WHERE "isVisible" ORDER BY "sortOrder", "nameEn"`
}

export function listPlans() {
  return readDb.plan.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { code: true, name: true, priceNpr: true, durationDays: true, features: true },
  })
}

// Only these settings are public; anything else Admin stores stays private.
export const PUBLIC_SETTINGS = ['emergency_numbers', 'contact', 'social_links']

export async function getPublicSettings() {
  const rows = await readDb.setting.findMany({ where: { key: { in: PUBLIC_SETTINGS } } })
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}
