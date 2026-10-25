import { db, readDb } from '../../config/db.js'
import { idPage } from '../../lib/cursor.js'
import { audit, changedFields } from '../../services/audit.js'
import { afterEventChange, eventInclude } from '../../services/events.js'
import { setEventLocation } from '../../services/geo.js'
import { assertArea } from '../../services/market.js'
import { publicIdFromUrl, queueMediaDelete } from '../../services/media.js'
import { ApiError } from '../../utils/ApiError.js'
import { noContent, ok } from '../../utils/ApiResponse.js'

const submitterSummary = { id: true, name: true, email: true }

/** Events queue (MODERATOR and up), with who submitted each one. */
export async function list(req, res) {
  const { status, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.event.findMany({
    where: { status, ...page.where },
    orderBy: page.orderBy,
    take: page.take,
    include: eventInclude,
  })
  const { items, nextCursor } = page.finish(rows)
  const ids = [...new Set(items.map((e) => e.submittedById).filter(Boolean))]
  const users = await readDb.user.findMany({ where: { id: { in: ids } }, select: submitterSummary })
  const byId = new Map(users.map((u) => [u.id, u]))
  return ok(
    res,
    items.map((e) => ({ ...e, submittedBy: byId.get(e.submittedById) ?? null })),
    { nextCursor },
  )
}

async function findEvent(id) {
  const event = await db.event.findUnique({ where: { id } })
  if (!event) throw ApiError.notFound('Event not found')
  return event
}

async function decide(req, res, status) {
  const event = await findEvent(req.params.id)
  await db.$transaction(async (tx) => {
    await tx.event.update({ where: { id: event.id }, data: { status } })
    await audit(tx, req, {
      action: status === 'APPROVED' ? 'event.approve' : 'event.reject',
      entity: 'event',
      entityId: event.id,
      diff: {
        status: { from: event.status, to: status },
        ...(req.body?.reason && { reason: req.body.reason }),
      },
    })
  })
  await afterEventChange([event])
  return ok(res, { id: event.id, status })
}

export const approve = (req, res) => decide(req, res, 'APPROVED')
export const reject = (req, res) => decide(req, res, 'REJECTED')

export async function update(req, res) {
  const before = await findEvent(req.params.id)
  const { location, ...data } = req.body
  await assertArea(data.areaId)
  const event = await db.$transaction(async (tx) => {
    const row = await tx.event.update({ where: { id: before.id }, data })
    if (location !== undefined) await setEventLocation(tx, before.id, location)
    await audit(tx, req, {
      action: 'event.update',
      entity: 'event',
      entityId: before.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  await afterEventChange([event])
  return ok(res, event)
}

export async function remove(req, res) {
  const event = await findEvent(req.params.id)
  await db.$transaction(async (tx) => {
    await tx.event.delete({ where: { id: event.id } })
    await audit(tx, req, {
      action: 'event.delete',
      entity: 'event',
      entityId: event.id,
      diff: { title: event.title },
    })
  })
  await queueMediaDelete(publicIdFromUrl(event.coverUrl))
  await afterEventChange([event])
  return noContent(res)
}
