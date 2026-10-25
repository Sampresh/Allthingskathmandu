import { parse } from 'csv-parse/sync'
import { db } from '../config/db.js'
import { QUEUE, enqueue } from '../jobs/queues.js'
import { listingCreate } from '../validators/admin.validators.js'
import { createListing, updateListing } from './listings.js'
import { pageTagsFor, queueContentChange } from './revalidate.js'

const MAX_ROWS = 2000
const MAX_REPORTED_ERRORS = 50

const list = (value) =>
  value
    ? value
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean)
    : []
const blank = (value) => (value === undefined || value === '' ? undefined : value)
const number = (value) => (blank(value) === undefined ? undefined : Number(value))

/**
 * Columns: name, nameNe, slug, type, category (slugs, ";"-separated, first is primary),
 * tags, area, shortDesc, description, phone, whatsapp, email, website, playStoreUrl,
 * appStoreUrl, address, lat, lng, priceLevel, status. Rows with an existing slug update that
 * listing; others create one. New listings default to DRAFT.
 */
export async function importListings({ csv, actorId, ip }) {
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true, bom: true })
  if (rows.length > MAX_ROWS) throw new Error(`Too many rows: ${rows.length} (max ${MAX_ROWS})`)

  const [categories, areas, tags] = await Promise.all([
    db.category.findMany({
      where: { kind: 'DIRECTORY', parentId: { not: null } },
      select: { id: true, slug: true },
    }),
    db.area.findMany({ select: { id: true, slug: true } }),
    db.tag.findMany({ select: { id: true, slug: true } }),
  ])
  const idOf = (items) => new Map(items.map((i) => [i.slug, i.id]))
  const categoryIds = idOf(categories)
  const areaIds = idOf(areas)
  const tagIds = idOf(tags)

  const result = { created: 0, updated: 0, failed: 0, errors: [] }
  const touchedCategories = new Set()
  const fail = (row, message) => {
    result.failed += 1
    if (result.errors.length < MAX_REPORTED_ERRORS) result.errors.push({ row, message })
  }

  for (const [index, raw] of rows.entries()) {
    const rowNumber = index + 2 // header is row 1
    const unknown = [
      ...list(raw.category)
        .filter((s) => !categoryIds.has(s))
        .map((s) => `category ${s}`),
      ...list(raw.tags)
        .filter((s) => !tagIds.has(s))
        .map((s) => `tag ${s}`),
      ...(blank(raw.area) && !areaIds.has(raw.area) ? [`area ${raw.area}`] : []),
    ]
    if (unknown.length) {
      fail(rowNumber, `Unknown ${unknown.join(', ')}`)
      continue
    }

    const lat = number(raw.lat)
    const lng = number(raw.lng)
    const parsed = listingCreate.safeParse({
      name: raw.name,
      nameNe: blank(raw.nameNe),
      slug: blank(raw.slug),
      type: blank(raw.type) ?? 'BUSINESS',
      categoryIds: list(raw.category).map((s) => categoryIds.get(s)),
      tagIds: list(raw.tags).map((s) => tagIds.get(s)),
      areaId: blank(raw.area) ? areaIds.get(raw.area) : undefined,
      shortDesc: raw.shortDesc,
      description: blank(raw.description),
      phone: blank(raw.phone),
      whatsapp: blank(raw.whatsapp),
      email: blank(raw.email),
      website: blank(raw.website),
      playStoreUrl: blank(raw.playStoreUrl),
      appStoreUrl: blank(raw.appStoreUrl),
      address: blank(raw.address),
      location: lat !== undefined && lng !== undefined ? { lat, lng } : undefined,
      priceLevel: number(raw.priceLevel),
      status: blank(raw.status) ?? 'DRAFT',
    })
    if (!parsed.success) {
      fail(
        rowNumber,
        parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
      )
      continue
    }

    try {
      const input = parsed.data
      const existing = input.slug
        ? await db.business.findFirst({
            where: { slug: input.slug, deletedAt: null },
            select: { id: true },
          })
        : null
      await db.$transaction(async (tx) => {
        const listing = existing
          ? await updateListing(tx, existing.id, input)
          : await createListing(tx, input)
        await tx.auditLog.create({
          data: {
            actorId,
            action: existing ? 'business.import_update' : 'business.import_create',
            entity: 'business',
            entityId: listing.id,
            ip,
          },
        })
      })
      existing ? (result.updated += 1) : (result.created += 1)
      input.categoryIds.forEach((id) => touchedCategories.add(id))
    } catch (err) {
      fail(rowNumber, err.code === 'P2002' ? 'Duplicate value' : err.message)
    }
  }

  if (result.created || result.updated) {
    const touched = categories.filter((c) => touchedCategories.has(c.id))
    await Promise.all([
      enqueue(QUEUE.DIRECTORY, 'sync-listings', {}),
      enqueue(QUEUE.DIRECTORY, 'refresh-counts', {}),
      queueContentChange({
        cacheTags: ['home', 'search', 'groups', ...touched.map((c) => `category:${c.id}`)],
        pageTags: pageTagsFor({ categories: touched, extra: ['home', 'groups'] }),
      }),
    ])
  }
  return result
}
