import { db, readDb } from '../../config/db.js'
import { idPage } from '../../lib/cursor.js'
import { audit } from '../../services/audit.js'
import { afterItemChange, dropPhotos, liveUntil } from '../../services/market.js'
import { ApiError } from '../../utils/ApiError.js'
import { noContent, ok } from '../../utils/ApiResponse.js'

/** Market queue (MODERATOR and up): the item, its photos, seller and category. */
export async function list(req, res) {
  const { status, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.marketItem.findMany({
    where: { status, deletedAt: null, ...page.where },
    orderBy: page.orderBy,
    take: page.take,
    include: {
      media: { orderBy: { sortOrder: 'asc' } },
      category: { select: { id: true, slug: true, nameEn: true } },
      area: { select: { id: true, slug: true, nameEn: true } },
      seller: { select: { id: true, name: true, email: true, phone: true } },
    },
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

async function findItem(id) {
  const item = await db.marketItem.findFirst({
    where: { id, deletedAt: null },
    include: { media: true },
  })
  if (!item) throw ApiError.notFound('Item not found')
  return item
}

/** Approval puts the item live for 30 days (from now). */
export async function approve(req, res) {
  const item = await findItem(req.params.id)
  if (item.status === 'SOLD') throw ApiError.badRequest('This item is sold')
  const expiresAt = liveUntil()
  await db.$transaction(async (tx) => {
    await tx.marketItem.update({ where: { id: item.id }, data: { status: 'LIVE', expiresAt } })
    await audit(tx, req, {
      action: 'market.approve',
      entity: 'market_item',
      entityId: item.id,
      diff: { status: { from: item.status, to: 'LIVE' }, expiresAt },
    })
  })
  await afterItemChange([item])
  return ok(res, { id: item.id, status: 'LIVE', expiresAt })
}

export async function reject(req, res) {
  const item = await findItem(req.params.id)
  await db.$transaction(async (tx) => {
    await tx.marketItem.update({
      where: { id: item.id },
      data: { status: 'REJECTED', expiresAt: null },
    })
    await audit(tx, req, {
      action: 'market.reject',
      entity: 'market_item',
      entityId: item.id,
      diff: {
        status: { from: item.status, to: 'REJECTED' },
        ...(req.body?.reason && { reason: req.body.reason }),
      },
    })
  })
  if (item.status === 'LIVE') await afterItemChange([item])
  return ok(res, { id: item.id, status: 'REJECTED' })
}

export async function remove(req, res) {
  const item = await findItem(req.params.id)
  await db.$transaction(async (tx) => {
    await tx.marketItemMedia.deleteMany({ where: { itemId: item.id } })
    await tx.marketItem.update({ where: { id: item.id }, data: { deletedAt: new Date() } })
    await audit(tx, req, {
      action: 'market.delete',
      entity: 'market_item',
      entityId: item.id,
      diff: { title: item.title },
    })
  })
  await dropPhotos(item.media.map((m) => m.publicId))
  await afterItemChange([item])
  return noContent(res)
}
