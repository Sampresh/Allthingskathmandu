import { z } from 'zod'
import { readDb } from '../config/db.js'
import { Prisma } from '../generated/prisma/client'
import { decodeCursor, encodeCursor } from '../lib/cursor.js'
import { publishProblems } from '../validators/listing.schema.js'

// Sortable columns: SQL expression, its type (for the keyset cursor) and default direction.
// NULLs are folded into '~', which sorts after letters only in the "C" collation.
const SORTS = {
  // timestamp(3) without time zone, stored in UTC; an ISO cursor's "Z" is ignored on cast.
  updated: { sql: Prisma.sql`b."updatedAt"`, type: 'timestamp', dir: 'desc' },
  name: { sql: Prisma.sql`lower(b.name)`, type: 'text', dir: 'asc' },
  category: {
    sql: Prisma.sql`(COALESCE(lower(pc."nameEn"), '~') COLLATE "C")`,
    type: 'text',
    dir: 'asc',
  },
  area: {
    sql: Prisma.sql`(COALESCE(lower(a."nameEn"), '~') COLLATE "C")`,
    type: 'text',
    dir: 'asc',
  },
  type: { sql: Prisma.sql`b.type::text`, type: 'text', dir: 'asc' },
  status: { sql: Prisma.sql`b.status::text`, type: 'text', dir: 'asc' },
  verified: { sql: Prisma.sql`b."isVerified"`, type: 'boolean', dir: 'desc' },
  logo: { sql: Prisma.sql`(b."logoUrl" IS NOT NULL)`, type: 'boolean', dir: 'desc' },
}

const MISSING_SQL = {
  phone: Prisma.sql`COALESCE(b.phone, '') = ''`,
  hours: Prisma.sql`(b.hours IS NULL OR b.hours = 'null'::jsonb)`,
  location: Prisma.sql`b.location IS NULL`,
  logo: Prisma.sql`b."logoUrl" IS NULL`,
  // The one-line description: what cards show and publishing needs.
  description: Prisma.sql`b."shortDesc" = ''`,
  area: Prisma.sql`b."areaId" IS NULL`,
}

// Primary category (and its group) and area of each listing.
const joins = Prisma.sql`
  LEFT JOIN areas a ON a.id = b."areaId"
  LEFT JOIN users o ON o.id = b."ownerId"
  LEFT JOIN LATERAL (
    SELECT c.id, c."nameEn", c."parentId", g."nameEn" AS "groupNameEn"
    FROM business_categories bc
    JOIN categories c ON c.id = bc."categoryId"
    LEFT JOIN categories g ON g.id = c."parentId"
    WHERE bc."businessId" = b.id AND bc."isPrimary"
    LIMIT 1
  ) pc ON true`

const escapeLike = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

/** WHERE conditions for the filters, except status and Trash (the tabs). */
function filterConditions(f) {
  const where = []
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`
    where.push(Prisma.sql`(b.name ILIKE ${like} OR b.slug ILIKE ${like}
      OR COALESCE(b.phone, '') ILIKE ${like} OR COALESCE(b.address, '') ILIKE ${like})`)
  }
  if (f.group)
    where.push(Prisma.sql`EXISTS (SELECT 1 FROM business_categories bc
      JOIN categories c ON c.id = bc."categoryId"
      WHERE bc."businessId" = b.id AND c."parentId" = ${f.group}::uuid)`)
  if (f.category)
    where.push(Prisma.sql`EXISTS (SELECT 1 FROM business_categories bc
      WHERE bc."businessId" = b.id AND bc."categoryId" = ${f.category}::uuid)`)
  if (f.area === 'none') where.push(Prisma.sql`b."areaId" IS NULL`)
  else if (f.area) where.push(Prisma.sql`b."areaId" = ${f.area}::uuid`)
  if (f.type) where.push(Prisma.sql`b.type = ${f.type}::"ListingType"`)
  if (f.verified !== undefined) where.push(Prisma.sql`b."isVerified" = ${f.verified}`)
  if (f.featured !== undefined)
    where.push(
      f.featured
        ? Prisma.sql`COALESCE(b."featuredUntil" > now(), false)`
        : Prisma.sql`NOT COALESCE(b."featuredUntil" > now(), false)`,
    )
  if (f.hasOwner !== undefined)
    where.push(f.hasOwner ? Prisma.sql`b."ownerId" IS NOT NULL` : Prisma.sql`b."ownerId" IS NULL`)
  for (const field of f.missing ?? []) where.push(MISSING_SQL[field])
  return where
}

function tabCondition(status) {
  if (status === 'TRASH') return Prisma.sql`b."deletedAt" IS NOT NULL`
  if (status) return Prisma.sql`b."deletedAt" IS NULL AND b.status = ${status}::"ListingStatus"`
  return Prisma.sql`b."deletedAt" IS NULL`
}

const and = (conditions) =>
  conditions.length ? Prisma.join(conditions, ' AND ') : Prisma.sql`true`

const columns = Prisma.sql`
  b.id, b.slug, b.name, b.type, b.status, b."isVerified", b."featuredUntil", b."updatedAt",
  b."deletedAt", b."logoUrl", b."shortDesc", b.phone, b.hours, b.website, b."playStoreUrl",
  b."appStoreUrl", b.verification, b."googlePlaceId", b."profileScore", b."areaId",
  b.location IS NOT NULL AS pinned,
  a."nameEn" AS "areaNameEn",
  pc.id AS "categoryId", pc."nameEn" AS "categoryNameEn", pc."groupNameEn",
  o.id AS "ownerId", o.name AS "ownerName", o.email AS "ownerEmail"`

// What a listing of each type is expected to have (apps have no address, hotlines no logo).
const EXPECTED = {
  BUSINESS: ['phone', 'hours', 'location', 'logo', 'description', 'area'],
  PLACE: ['hours', 'location', 'logo', 'description', 'area'],
  APP: ['logo', 'description'],
  HOTLINE: ['phone'],
}

const rowOut = (r) => {
  const absent = {
    phone: !r.phone,
    hours: !r.hours,
    location: !r.pinned,
    logo: !r.logoUrl,
    description: !r.shortDesc,
    area: !r.areaId,
  }
  const missing = Object.fromEntries(EXPECTED[r.type].map((k) => [k, absent[k]]))
  const rules = { ...r, categoryIds: r.categoryId ? [r.categoryId] : [], location: r.pinned }
  return {
    id: r.id,
    slug: r.slug,
    name: r.name,
    type: r.type,
    status: r.status,
    isVerified: r.isVerified,
    featured: Boolean(r.featuredUntil && r.featuredUntil > new Date()),
    featuredUntil: r.featuredUntil,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt,
    logoUrl: r.logoUrl,
    googlePlaceId: r.googlePlaceId,
    profileScore: r.profileScore,
    area: r.areaId ? { id: r.areaId, nameEn: r.areaNameEn } : null,
    category: r.categoryId
      ? { id: r.categoryId, nameEn: r.categoryNameEn, groupNameEn: r.groupNameEn }
      : null,
    owner: r.ownerId ? { id: r.ownerId, name: r.ownerName, email: r.ownerEmail } : null,
    missing: Object.keys(missing).filter((k) => missing[k]),
    publishProblems: publishProblems(rules).map((p) => p.message),
  }
}

/** Listing counts per tab for the current filters. */
async function tabCounts(conditions) {
  const [row] = await readDb.$queryRaw`
    SELECT
      count(*) FILTER (WHERE b."deletedAt" IS NULL)::int AS "ALL",
      count(*) FILTER (WHERE b."deletedAt" IS NULL AND b.status = 'PENDING')::int AS "PENDING",
      count(*) FILTER (WHERE b."deletedAt" IS NULL AND b.status = 'LIVE')::int AS "LIVE",
      count(*) FILTER (WHERE b."deletedAt" IS NULL AND b.status = 'SUSPENDED')::int AS "SUSPENDED",
      count(*) FILTER (WHERE b."deletedAt" IS NULL AND b.status = 'DRAFT')::int AS "DRAFT",
      count(*) FILTER (WHERE b."deletedAt" IS NOT NULL)::int AS "TRASH"
    FROM businesses b ${joins}
    WHERE ${and(conditions)}`
  return row
}

const cursorSchema = z.tuple([z.union([z.string(), z.boolean()]), z.uuid()])

/**
 * One page of the admin table, keyset-paginated on (sort column, id), plus tab counts.
 * Returns { items, nextCursor, counts }.
 */
export async function listAdminListings({ sort, dir, cursor, limit, status, ...filters }) {
  const order = SORTS[sort]
  const direction = dir ?? order.dir
  const conditions = filterConditions(filters)
  const after = decodeCursor(cursor, cursorSchema)
  const cmp = direction === 'asc' ? Prisma.sql`>` : Prisma.sql`<`
  const keyset = after
    ? [
        Prisma.sql`(${order.sql}, b.id) ${cmp} (${after[0]}::${Prisma.raw(order.type)}, ${after[1]}::uuid)`,
      ]
    : []
  const dirSql = Prisma.raw(direction === 'asc' ? 'ASC' : 'DESC')

  const [rows, counts] = await Promise.all([
    readDb.$queryRaw`
      SELECT ${columns}, ${order.sql} AS "sortKey"
      FROM businesses b ${joins}
      WHERE ${and([tabCondition(status), ...conditions, ...keyset])}
      ORDER BY ${order.sql} ${dirSql}, b.id ${dirSql}
      LIMIT ${limit + 1}`,
    tabCounts(conditions),
  ])
  const items = rows.slice(0, limit)
  const last = items[items.length - 1]
  const sortValue = (value) => (value instanceof Date ? value.toISOString() : value)
  return {
    items: items.map(rowOut),
    nextCursor: rows.length > limit ? encodeCursor([sortValue(last.sortKey), last.id]) : null,
    counts,
  }
}

export const EXPORT_COLUMNS = [
  'id',
  'slug',
  'name',
  'nameNe',
  'type',
  'status',
  'group',
  'category',
  'area',
  'address',
  'lat',
  'lng',
  'phone',
  'whatsapp',
  'email',
  'website',
  'playStoreUrl',
  'appStoreUrl',
  'shortDesc',
  'description',
  'hours',
  'priceLevel',
  'isVerified',
  'featuredUntil',
  'ownerEmail',
  'profileScore',
  'updatedAt',
]
const MAX_EXPORT_ROWS = 20_000

/** Rows for the CSV export of the current filters. Google fields are left out. */
export async function exportAdminListings({ status, ...filters }) {
  const rows = await readDb.$queryRaw`
    SELECT b.id, b.slug, b.name, b."nameNe", b.type, b.status, pc."groupNameEn" AS "group",
      pc."nameEn" AS category, a."nameEn" AS area, b.address,
      ST_Y(b.location::geometry) AS lat, ST_X(b.location::geometry) AS lng,
      b.phone, b.whatsapp, b.email, b.website, b."playStoreUrl", b."appStoreUrl",
      b."shortDesc", b.description, b.hours, b."priceLevel", b."isVerified", b."featuredUntil",
      o.email AS "ownerEmail", b."profileScore", b."updatedAt"
    FROM businesses b ${joins}
    WHERE ${and([tabCondition(status), ...filterConditions(filters)])}
    ORDER BY lower(b.name), b.id
    LIMIT ${MAX_EXPORT_ROWS}`
  return rows.map((r) => ({
    ...r,
    featuredUntil: r.featuredUntil?.toISOString() ?? null,
    updatedAt: r.updatedAt.toISOString(),
  }))
}
