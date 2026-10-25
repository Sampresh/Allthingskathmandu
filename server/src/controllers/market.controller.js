import { db, readDb } from '../config/db.js'
import { idPage } from '../lib/cursor.js'
import { audit } from '../services/audit.js'
import {
  afterItemChange,
  assertArea,
  assertMarketCategory,
  confirmPhotos,
  dropPhotos,
  getItem,
  listItems,
  listMarketCategories,
  myItem,
  myItemInclude,
  newItemSlug,
} from '../services/market.js'
import { signUpload } from '../services/media.js'
import { ApiError } from '../utils/ApiError.js'
import { created, noContent, ok } from '../utils/ApiResponse.js'

// ---------- Public ----------

export async function categories(req, res) {
  return ok(res, await listMarketCategories())
}

export async function list(req, res) {
  const { items, nextCursor } = await listItems(req.query)
  return ok(res, items, { nextCursor })
}

export async function detail(req, res) {
  const item = await getItem(req.params.slug)
  if (!item) throw ApiError.notFound('Item not found')
  return ok(res, item)
}

// ---------- My items (Part 6 §4) ----------

export function signPhoto(req, res) {
  return ok(res, signUpload({ scope: 'market', id: req.user.id, kind: 'photo' }))
}

export async function mine(req, res) {
  const page = idPage(req.query.cursor, req.query.limit)
  const rows = await readDb.marketItem.findMany({
    where: { sellerId: req.user.id, deletedAt: null, ...page.where },
    orderBy: page.orderBy,
    take: page.take,
    include: myItemInclude,
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items.map(myItem), { nextCursor })
}

/** A new item waits as PENDING; approval puts it live for 30 days. */
export async function create(req, res) {
  const { photos, ...data } = req.body
  await assertMarketCategory(data.categoryId)
  await assertArea(data.areaId)
  const media = await confirmPhotos(req.user.id, photos)
  const item = await db.$transaction(async (tx) => {
    const row = await tx.marketItem.create({
      data: {
        ...data,
        sellerId: req.user.id,
        slug: await newItemSlug(tx, data.title),
        status: 'PENDING',
        media: { create: media },
      },
      include: myItemInclude,
    })
    await audit(tx, req, {
      action: 'market.submit',
      entity: 'market_item',
      entityId: row.id,
      diff: { title: row.title },
    })
    return row
  })
  return created(res, myItem(item))
}

async function ownItem(req) {
  const item = await db.marketItem.findFirst({
    where: { id: req.params.id, sellerId: req.user.id, deletedAt: null },
    include: myItemInclude,
  })
  if (!item) throw ApiError.notFound('Item not found')
  return item
}

/** Any edit goes back to moderation (PENDING) and takes the item down until approved. */
export async function update(req, res) {
  const before = await ownItem(req)
  if (before.status === 'SOLD') throw ApiError.badRequest('Sold items cannot be edited')
  const { photos, ...data } = req.body
  const merged = { ...before, ...data }
  if (!merged.contactPhone && !merged.contactWhatsapp) {
    throw ApiError.validation([{ path: 'contactPhone', message: 'Add a phone or WhatsApp number' }])
  }
  if (data.categoryId) await assertMarketCategory(data.categoryId)
  if (data.areaId) await assertArea(data.areaId)
  const media = photos ? await confirmPhotos(req.user.id, photos, before.media) : null

  const item = await db.$transaction(async (tx) => {
    if (media) {
      await tx.marketItemMedia.deleteMany({ where: { itemId: before.id } })
      await tx.marketItemMedia.createMany({
        data: media.map((m) => ({ ...m, itemId: before.id })),
      })
    }
    return tx.marketItem.update({
      where: { id: before.id },
      data: { ...data, status: 'PENDING', expiresAt: null },
      include: myItemInclude,
    })
  })
  if (media) {
    const kept = new Set(media.map((m) => m.publicId))
    await dropPhotos(before.media.map((m) => m.publicId).filter((id) => !kept.has(id)))
  }
  if (before.status === 'LIVE') await afterItemChange([before])
  return ok(res, myItem(item))
}

export async function remove(req, res) {
  const item = await ownItem(req)
  await db.$transaction([
    db.marketItemMedia.deleteMany({ where: { itemId: item.id } }),
    db.marketItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } }),
  ])
  await dropPhotos(item.media.map((m) => m.publicId))
  if (item.status === 'LIVE') await afterItemChange([item])
  return noContent(res)
}

export async function markSold(req, res) {
  const item = await ownItem(req)
  if (item.status !== 'LIVE') throw ApiError.badRequest('Only live items can be marked sold')
  const sold = await db.marketItem.update({
    where: { id: item.id },
    data: { status: 'SOLD' },
    include: myItemInclude,
  })
  await afterItemChange([item])
  return ok(res, myItem(sold))
}
