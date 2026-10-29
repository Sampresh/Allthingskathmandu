import { parse } from 'csv-parse/sync'
import { db } from '../config/db.js'
import { QUEUE, enqueue } from '../jobs/queues.js'
import { matchArea } from '../lib/areaMatch.js'
import { toCsv } from '../lib/csv.js'
import { parseHoursText } from '../lib/hours.js'
import { slugify } from '../lib/slug.js'
import { ApiError } from '../utils/ApiError.js'
import {
  LISTING_TYPES,
  SHORT_DESC_MAX,
  VERIFICATION_ITEMS,
  isShortCode,
  listingCreate,
} from '../validators/listing.schema.js'
import { createListing, updateListing } from './listings.js'
import { pageTagsFor, queueContentChange } from './revalidate.js'
import { syncTaxonomy, taxonomyCategories } from './taxonomySync.js'

/*
 * Listings import in the docs/LISTINGS.md format. Columns: category, type, name, address,
 * phone, hours, website, desc, g_rating, g_reviews, place_id. g_rating and g_reviews are never
 * stored (Google terms). Rows are ranked within each category, so they are written in file
 * order. Matching (so a re-run never duplicates): place_id, else name + primary category.
 * New listings are PENDING, unverified and unowned; updates fill in what the file has and
 * never change status, verification, owner or categories.
 */

export const IMPORT_COLUMNS = [
  'category',
  'type',
  'name',
  'address',
  'phone',
  'hours',
  'website',
  'desc',
  'g_rating',
  'g_reviews',
  'place_id',
]
const REQUIRED_COLUMNS = ['category', 'type', 'name']
const MAX_ROWS = 5000
const UNVERIFIED = Object.fromEntries(VERIFICATION_ITEMS.map((k) => [k, false]))
// Types that sit at a street address and so need an area.
const PLACED = new Set(['BUSINESS', 'PLACE'])
// Fields an update may fill in from the file.
const UPDATABLE = ['name', 'type', 'shortDesc', 'phone', 'website', 'address', 'hours']

const clean = (value) => String(value ?? '').trim()
const matchKey = (name, categoryId) => `${clean(name).toLowerCase()}|${categoryId}`

/** Parses the CSV text; throws a 400 naming missing columns. Rows carry their line number. */
export function parseListingsCsv(csv) {
  let records
  try {
    records = parse(csv, { columns: true, skip_empty_lines: true, bom: true, relax_quotes: false })
  } catch (err) {
    throw ApiError.badRequest(`Could not read the CSV: ${err.message}`)
  }
  const header = records.length ? Object.keys(records[0]) : []
  const missing = REQUIRED_COLUMNS.filter((c) => !header.includes(c))
  if (missing.length) throw ApiError.badRequest(`Missing columns: ${missing.join(', ')}`)
  if (records.length > MAX_ROWS)
    throw ApiError.badRequest(`Too many rows: ${records.length} (max ${MAX_ROWS})`)
  return records.map((raw, index) => ({ line: index + 2, raw })) // header is line 1
}

/** Everything a plan needs from the database, read once. */
async function loadContext(client) {
  const [categories, areas, existing] = await Promise.all([
    client.category.findMany({
      where: { kind: 'DIRECTORY', parentId: { not: null } },
      select: { id: true, slug: true, nameEn: true },
    }),
    client.area.findMany({ select: { id: true, slug: true, nameEn: true, aliases: true } }),
    client.business.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        shortDesc: true,
        phone: true,
        website: true,
        address: true,
        hours: true,
        areaId: true,
        adminNote: true,
        googlePlaceId: true,
        deletedAt: true,
        categories: { where: { isPrimary: true }, select: { categoryId: true } },
      },
    }),
  ])
  const byPlaceId = new Map()
  const byName = new Map()
  for (const listing of existing) {
    if (listing.googlePlaceId) byPlaceId.set(listing.googlePlaceId, listing)
    const primary = listing.categories[0]?.categoryId
    if (primary && !byName.has(matchKey(listing.name, primary)))
      byName.set(matchKey(listing.name, primary), listing)
  }
  return {
    categories: new Map(categories.map((c) => [c.slug, c])),
    planned: taxonomyCategories(),
    areas,
    byPlaceId,
    byName,
    slugs: new Set(existing.map((l) => l.slug)),
  }
}

/** Free slug: name, then name-area, then name-area-2 … (also unique within this import). */
function pickSlug(name, area, taken) {
  const base = slugify(name).slice(0, 80).replace(/-+$/, '') || 'listing'
  const withArea = area ? `${base}-${area.slug}` : base
  const candidates = [base, withArea]
  for (let n = 2; n < 1000; n += 1) candidates.push(`${withArea}-${n}`)
  const slug = candidates.find((c) => !taken.has(c))
  taken.add(slug)
  return slug
}

// Key order independent: Postgres jsonb does not keep the order hours were written in.
const canonical = (value) =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((k) => [k, canonical(value[k])]),
      )
    : value
const sameJson = (a, b) =>
  JSON.stringify(canonical(a ?? null)) === JSON.stringify(canonical(b ?? null))

/** Maps one CSV row to { action, data, … }; never writes. */
function planRow({ line, raw }, ctx) {
  const name = clean(raw.name)
  const row = { line, name, action: 'error', messages: [], flags: [] }
  const error = (message) => {
    row.messages.push(message)
    return row
  }

  const type = clean(raw.type).toUpperCase()
  if (!name) return error('Name is empty')
  if (!LISTING_TYPES.includes(type)) return error(`Unknown type "${clean(raw.type)}"`)

  const categorySlug = slugify(clean(raw.category))
  const category = ctx.categories.get(categorySlug)
  if (!category && !ctx.planned.has(categorySlug))
    return error(`Unknown category "${clean(raw.category)}"`)
  row.category = category?.nameEn ?? ctx.planned.get(categorySlug).nameEn

  const shortDesc = clean(raw.desc)
  if (shortDesc.length > SHORT_DESC_MAX)
    return error(`desc is ${shortDesc.length} characters (max ${SHORT_DESC_MAX})`)

  const phone = clean(raw.phone) || null
  if (phone && isShortCode(phone) && type !== 'HOTLINE')
    return error(`Phone "${phone}" is a short code; only hotlines may use one`)

  const domain = clean(raw.website)
  let website = null
  if (domain) {
    try {
      website = new URL(/^https?:\/\//i.test(domain) ? domain : `https://${domain}`).toString()
      website = website.replace(/\/$/, '')
    } catch {
      return error(`Website "${domain}" is not a domain`)
    }
  }

  const address = clean(raw.address) || null
  const area = address ? matchArea(address, ctx.areas) : null
  if (!area && PLACED.has(type)) row.flags.push('needs area')
  row.area = area?.nameEn ?? null

  const hoursText = clean(raw.hours)
  const parsedHours = parseHoursText(hoursText)
  let adminNote = null
  if (parsedHours.error) {
    adminNote = `Hours from import: ${hoursText}`
    row.flags.push('hours need review')
  }
  row.flags.push(...(parsedHours.warnings ?? []))

  const googlePlaceId = clean(raw.place_id) || null
  const data = {
    name,
    type,
    shortDesc,
    phone,
    website,
    address,
    hours: parsedHours.hours,
    googlePlaceId,
    adminNote,
    areaId: area?.id ?? null,
  }

  // Match: place id first, then name within the primary category.
  const existing =
    (googlePlaceId && ctx.byPlaceId.get(googlePlaceId)) ||
    (category && ctx.byName.get(matchKey(name, category.id)))

  if (existing?.line) return error(`Same listing as line ${existing.line}`)
  if (existing) {
    row.id = existing.id
    row.slug = existing.slug
    if (existing.areaId || !PLACED.has(type))
      row.flags = row.flags.filter((f) => f !== 'needs area')
    if (existing.deletedAt) {
      row.action = 'skip'
      row.messages.push('Listing is in Trash; restore it to update')
      return row
    }
    // Fill in what the file has; empty cells never clear a value.
    const patch = {}
    for (const field of UPDATABLE) {
      const value = data[field]
      if (value === null || value === '') continue
      if (!sameJson(existing[field], value)) patch[field] = value
    }
    if (googlePlaceId && !existing.googlePlaceId) patch.googlePlaceId = googlePlaceId
    if (!existing.areaId && data.areaId) patch.areaId = data.areaId
    if (adminNote && !(existing.adminNote ?? '').includes(hoursText))
      patch.adminNote = [existing.adminNote, adminNote].filter(Boolean).join('\n')
    if (!Object.keys(patch).length) {
      row.action = 'skip'
      row.messages.push('No changes')
      return row
    }
    row.action = 'update'
    row.data = patch
    row.messages.push(`Updates ${Object.keys(patch).join(', ')}`)
    return row
  }

  row.slug = pickSlug(name, area, ctx.slugs)
  row.action = 'create'
  row.categorySlug = categorySlug
  row.data = {
    ...data,
    slug: row.slug,
    status: 'PENDING',
    isVerified: false,
    verification: UNVERIFIED,
  }
  // The same rules the API applies to a listing (category id is filled in at write time).
  const check = listingCreate.safeParse({
    ...row.data,
    categoryIds: ['00000000-0000-7000-8000-000000000000'],
  })
  if (!check.success) {
    row.action = 'error'
    row.messages.push(...check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`))
  }
  // Later rows naming the same listing are reported, not written twice.
  if (category) ctx.byName.set(matchKey(name, category.id), { line })
  if (googlePlaceId) ctx.byPlaceId.set(googlePlaceId, { line })
  return row
}

const summarise = (rows) => {
  const counts = { total: rows.length, create: 0, update: 0, skip: 0, error: 0 }
  for (const row of rows) counts[row.action] += 1
  counts.needsArea = rows.filter((r) => r.flags.includes('needs area')).length
  counts.hoursToReview = rows.filter((r) => r.flags.includes('hours need review')).length
  return counts
}

const reportRow = ({ line, action, name, slug, id, category, area, messages, flags }) => ({
  line,
  action,
  name,
  slug: slug ?? null,
  id: id ?? null,
  category: category ?? null,
  area: area ?? null,
  messages,
  flags,
})

/**
 * Dry run: what an import would do, row by row, without writing. Groups and categories from
 * prisma/data/taxonomy.js that do not exist yet count as known (a real run creates them).
 */
export async function planImport(csv, client = db) {
  const rows = parseListingsCsv(csv)
  const ctx = await loadContext(client)
  const planned = rows.map((row) => planRow(row, ctx))
  return { counts: summarise(planned), rows: planned.map(reportRow), plan: planned }
}

/**
 * Real run: syncs the taxonomy, then writes each row in file order (one transaction per row,
 * with an audit log). onProgress({ done, total }) is called as rows finish.
 */
export async function runImport({ csv, actorId = null, ip = null, onProgress = () => {} }) {
  await syncTaxonomy(db)
  const { plan } = await planImport(csv)
  const categories = new Map(
    (
      await db.category.findMany({
        where: { kind: 'DIRECTORY', parentId: { not: null } },
        select: { id: true, slug: true },
      })
    ).map((c) => [c.slug, c]),
  )
  const touchedIds = []
  const touchedCategories = new Map()

  for (const [index, row] of plan.entries()) {
    if (row.action === 'create' || row.action === 'update') {
      try {
        const listing = await db.$transaction(async (tx) => {
          const saved =
            row.action === 'create'
              ? await createListing(tx, {
                  ...row.data,
                  categoryIds: [categories.get(row.categorySlug).id],
                })
              : await updateListing(tx, row.id, row.data)
          await tx.auditLog.create({
            data: {
              actorId,
              action: row.action === 'create' ? 'business.import_create' : 'business.import_update',
              entity: 'business',
              entityId: saved.id,
              diff: row.action === 'update' ? { fields: Object.keys(row.data) } : undefined,
              ip,
            },
          })
          return saved
        })
        row.id = listing.id
        row.slug = listing.slug
        touchedIds.push(listing.id)
        const category = categories.get(row.categorySlug)
        if (category) touchedCategories.set(category.id, category)
      } catch (err) {
        row.action = 'error'
        row.messages = [err.code === 'P2002' ? 'Duplicate slug or place id' : err.message]
      }
    }
    if ((index + 1) % 10 === 0 || index === plan.length - 1)
      await onProgress({ done: index + 1, total: plan.length })
  }

  if (touchedIds.length) {
    const categoryList = [...touchedCategories.values()]
    await Promise.all([
      enqueue(QUEUE.DIRECTORY, 'sync-listings', { businessIds: touchedIds }),
      enqueue(QUEUE.DIRECTORY, 'refresh-counts', {}),
      queueContentChange({
        cacheTags: ['home', 'search', 'groups', ...categoryList.map((c) => `category:${c.id}`)],
        pageTags: pageTagsFor({ categories: categoryList, extra: ['home', 'groups'] }),
      }),
    ])
  }
  return { counts: summarise(plan), rows: plan.map(reportRow) }
}

/** Row-level report as CSV, for download after a run. */
export function resultCsv(rows) {
  return toCsv(
    rows.map((r) => ({
      line: r.line,
      action: r.action,
      name: r.name,
      slug: r.slug ?? '',
      id: r.id ?? '',
      category: r.category ?? '',
      area: r.area ?? '',
      flags: r.flags.join('; '),
      messages: r.messages.join('; '),
    })),
    ['line', 'action', 'name', 'slug', 'id', 'category', 'area', 'flags', 'messages'],
  )
}
