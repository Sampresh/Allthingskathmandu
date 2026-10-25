import { db, readDb } from '../config/db.js'
import { idPage } from '../lib/cursor.js'
import { uniqueSlug } from '../lib/slug.js'
import { ApiError } from '../utils/ApiError.js'
import { clientUrl, queueEmail } from './email.js'
import { confirmUpload, queueMediaDelete } from './media.js'
import { queueContentChange } from './revalidate.js'

export const LISTING_DAYS = 30
const DAY_MS = 24 * 60 * 60 * 1000

const areaOf = (a) => (a ? { slug: a.slug, nameEn: a.nameEn, nameNe: a.nameNe } : null)
const firstName = (name) => name.trim().split(/\s+/)[0]

/** Live in public: approved, not deleted, not past its 30 days. */
export const publicItemWhere = (now = new Date()) => ({
  status: 'LIVE',
  deletedAt: null,
  expiresAt: { gt: now },
})

export const itemCard = (i) => ({
  id: i.id,
  slug: i.slug,
  title: i.title,
  priceNpr: i.priceNpr,
  isNegotiable: i.isNegotiable,
  condition: i.condition,
  createdAt: i.createdAt,
  photo: i.media?.[0] ? { url: i.media[0].url, altText: i.media[0].altText } : null,
  area: areaOf(i.area),
})

const cardInclude = { area: true, media: { orderBy: { sortOrder: 'asc' }, take: 1 } }

export function listMarketCategories() {
  return readDb.category.findMany({
    where: { kind: 'MARKET', isVisible: true },
    orderBy: [{ sortOrder: 'asc' }, { nameEn: 'asc' }],
    select: { id: true, slug: true, nameEn: true, nameNe: true, icon: true },
  })
}

/** Live items, newest first. Filters: category, condition, price range, area, title text. */
export async function listItems({ category, condition, min, max, area, q, cursor, limit }) {
  const page = idPage(cursor, limit)
  const rows = await readDb.marketItem.findMany({
    where: {
      ...publicItemWhere(),
      ...page.where,
      ...(category && { category: { slug: category, kind: 'MARKET' } }),
      ...(condition && { condition }),
      ...((min != null || max != null) && {
        priceNpr: { ...(min != null && { gte: min }), ...(max != null && { lte: max }) },
      }),
      ...(area && { area: { slug: area } }),
      // ILIKE, served by the trigram index on title.
      ...(q && { title: { contains: q, mode: 'insensitive' } }),
    },
    orderBy: page.orderBy,
    take: page.take,
    include: cardInclude,
  })
  const { items, nextCursor } = page.finish(rows)
  return { items: items.map(itemCard), nextCursor }
}

/** Public item page (Part 4 §3): photos, price, condition, area, seller first name, contact. */
export async function getItem(slug) {
  const item = await readDb.marketItem.findFirst({
    where: { slug, ...publicItemWhere() },
    include: {
      area: true,
      category: true,
      media: { orderBy: { sortOrder: 'asc' } },
      seller: { select: { name: true } },
    },
  })
  if (!item) return null
  return {
    ...itemCard(item),
    description: item.description,
    photos: item.media.map((m) => ({ id: m.id, url: m.url, altText: m.altText })),
    category: {
      slug: item.category.slug,
      nameEn: item.category.nameEn,
      nameNe: item.category.nameNe,
    },
    seller: { firstName: firstName(item.seller.name) },
    contact: { phone: item.contactPhone, whatsapp: item.contactWhatsapp },
    expiresAt: item.expiresAt,
  }
}

/** The seller's view of their item, any status. */
export const myItem = (i) => ({
  ...itemCard(i),
  description: i.description,
  categoryId: i.categoryId,
  areaId: i.areaId,
  contactPhone: i.contactPhone,
  contactWhatsapp: i.contactWhatsapp,
  status: i.status,
  expiresAt: i.expiresAt,
  photos: (i.media ?? []).map((m) => ({ publicId: m.publicId, url: m.url, altText: m.altText })),
})

export const myItemInclude = { area: true, media: { orderBy: { sortOrder: 'asc' } } }

export async function assertMarketCategory(categoryId) {
  const category = await db.category.findFirst({
    where: { id: categoryId, kind: 'MARKET', isVisible: true },
  })
  if (!category) throw ApiError.badRequest('Pick a market category')
}

export async function assertArea(areaId) {
  if (areaId && !(await db.area.count({ where: { id: areaId } })))
    throw ApiError.badRequest('Unknown area')
}

const itemSlugTaken = (client) => async (candidate) =>
  (await client.marketItem.count({ where: { slug: candidate } })) > 0

export const newItemSlug = (client, title) => uniqueSlug(title, itemSlugTaken(client), 'item')

/**
 * Checks the photos against Cloudinary (files must be the seller's own uploads). Photos the
 * item already has are kept as they are. Returns rows for market_item_media in order.
 */
export async function confirmPhotos(sellerId, photos, existing = []) {
  const known = new Map(existing.map((m) => [m.publicId, m]))
  const rows = []
  for (const [sortOrder, photo] of photos.entries()) {
    const current = known.get(photo.publicId)
    const url = current
      ? current.url
      : (
          await confirmUpload({
            publicId: photo.publicId,
            scope: 'market',
            id: sellerId,
            kind: 'photo',
          })
        ).url
    rows.push({ publicId: photo.publicId, url, altText: photo.altText, sortOrder })
  }
  return rows
}

/** Removes Cloudinary files no longer used by an item (after the DB change commits). */
export async function dropPhotos(publicIds) {
  for (const publicId of publicIds) await queueMediaDelete(publicId)
}

/** Approval starts the 30 days. */
export const liveUntil = (now = new Date()) => new Date(now.getTime() + LISTING_DAYS * DAY_MS)

/** After an item changes in public: purge the API cache and the pages. */
export function afterItemChange(items) {
  const pageTags = new Set(['market', 'home'])
  for (const i of items) for (const v of [i.id, i.slug]) if (v) pageTags.add(`market:${v}`)
  return queueContentChange({
    cacheTags: ['market', 'home', ...items.map((i) => `market:${i.id}`)],
    pageTags: [...pageTags],
  })
}

/**
 * Worker job (hourly): items past their 30 days come down and each seller gets one email.
 * The status change is conditional, so a second run never emails twice.
 */
export async function expireMarketItems(now = new Date()) {
  const due = await db.marketItem.findMany({
    where: { status: 'LIVE', deletedAt: null, expiresAt: { lte: now } },
    select: {
      id: true,
      slug: true,
      title: true,
      seller: { select: { name: true, email: true, deletedAt: true } },
    },
  })
  const expired = []
  for (const item of due) {
    const { count } = await db.marketItem.updateMany({
      where: { id: item.id, status: 'LIVE' },
      data: { status: 'EXPIRED' },
    })
    if (!count) continue
    expired.push(item)
    if (!item.seller.deletedAt) {
      await queueEmail(item.seller.email, 'market-expired', {
        name: firstName(item.seller.name),
        title: item.title,
        url: clientUrl('/account/market'),
      })
    }
  }
  if (expired.length) await afterItemChange(expired)
  return { expired: expired.length }
}
