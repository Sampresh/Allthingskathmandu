import { db, readDb } from '../../config/db.js'
import { idPage } from '../../lib/cursor.js'
import { audit } from '../../services/audit.js'
import { afterListingChange, categoryIdsOf } from '../../services/listings.js'
import { queueMediaDelete } from '../../services/media.js'
import { ApiError } from '../../utils/ApiError.js'
import { ok } from '../../utils/ApiResponse.js'

export async function listMedia(req, res) {
  const { businessId, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.media.findMany({
    where: { ...page.where, ...(businessId && { businessId }) },
    orderBy: page.orderBy,
    take: page.take,
    include: { business: { select: { id: true, name: true, slug: true } } },
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

export async function deleteMedia(req, res) {
  const media = await db.media.findUnique({
    where: { id: req.params.id },
    include: { business: true },
  })
  if (!media) throw ApiError.notFound('Media not found')
  await db.$transaction(async (tx) => {
    await tx.media.delete({ where: { id: media.id } })
    await audit(tx, req, {
      action: 'media.delete',
      entity: 'media',
      entityId: media.id,
      diff: { businessId: media.businessId, url: media.url },
    })
  })
  await queueMediaDelete(media.publicId)
  await afterListingChange(media.business, await categoryIdsOf(db, media.businessId))
  return ok(res, { deleted: true })
}
