import { db, readDb } from '../config/db.js'
import { idPage } from '../lib/cursor.js'
import { audit } from '../services/audit.js'
import {
  createEvent,
  eventInclude,
  getEvent,
  listEvents,
  mySubmission,
} from '../services/events.js'
import { assertArea } from '../services/market.js'
import { confirmUpload, signUpload } from '../services/media.js'
import { ApiError } from '../utils/ApiError.js'
import { created, ok } from '../utils/ApiResponse.js'

// ---------- Public ----------

export async function list(req, res) {
  const { items, nextCursor } = await listEvents(req.query)
  return ok(res, items, { nextCursor })
}

export async function detail(req, res) {
  const event = await getEvent(req.params.slug)
  if (!event) throw ApiError.notFound('Event not found')
  return ok(res, event)
}

// ---------- Submissions (members, and owners for their listing) ----------

export function signCover(req, res) {
  return ok(res, signUpload({ scope: 'events', id: req.user.id, kind: 'cover' }))
}

async function submit(req, res, businessId) {
  const { coverPublicId, ...data } = req.body
  await assertArea(data.areaId)
  const cover = coverPublicId
    ? await confirmUpload({
        publicId: coverPublicId,
        scope: 'events',
        id: req.user.id,
        kind: 'cover',
      })
    : null
  const event = await db.$transaction(async (tx) => {
    const row = await createEvent(
      tx,
      { ...data, coverUrl: cover?.url ?? null },
      { submittedById: req.user.id, businessId },
    )
    await audit(tx, req, {
      action: 'event.submit',
      entity: 'event',
      entityId: row.id,
      diff: { title: row.title, businessId },
    })
    return row
  })
  return created(
    res,
    mySubmission(await db.event.findUnique({ where: { id: event.id }, include: eventInclude })),
  )
}

export const memberSubmit = (req, res) => submit(req, res, null)
export const ownerSubmit = (req, res) => submit(req, res, req.listing.id)

async function submissions(req, res, where) {
  const page = idPage(req.query.cursor, req.query.limit)
  const rows = await readDb.event.findMany({
    where: { ...where, ...page.where },
    orderBy: page.orderBy,
    take: page.take,
    include: eventInclude,
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items.map(mySubmission), { nextCursor })
}

export const mySubmissions = (req, res) => submissions(req, res, { submittedById: req.user.id })
export const listingSubmissions = (req, res) =>
  submissions(req, res, { businessId: req.listing.id })
