import { z } from 'zod'
import { readDb } from '../config/db.js'
import { decodeCursor, encodeCursor } from '../lib/cursor.js'
import { uniqueSlug } from '../lib/slug.js'
import { setEventLocation } from './geo.js'
import { queueContentChange } from './revalidate.js'

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000
const eventCursor = z.tuple([z.number().int(), z.uuid()])

/** Midnight in Kathmandu at the start of the day containing `date`. */
export function nepalDayStart(date = new Date()) {
  const local = new Date(date.getTime() + NEPAL_OFFSET_MS)
  local.setUTCHours(0, 0, 0, 0)
  return new Date(local.getTime() - NEPAL_OFFSET_MS)
}

const areaOf = (a) => (a ? { slug: a.slug, nameEn: a.nameEn, nameNe: a.nameNe } : null)

export const eventCard = (e) => ({
  id: e.id,
  slug: e.slug,
  title: e.title,
  startsAt: e.startsAt,
  endsAt: e.endsAt,
  venue: e.venue,
  coverUrl: e.coverUrl,
  area: areaOf(e.area),
  business: e.business ? { slug: e.business.slug, name: e.business.name } : null,
})

export const eventInclude = {
  area: true,
  business: { select: { slug: true, name: true, status: true, deletedAt: true } },
}

// A listing link only while the listing itself is public.
const withLiveBusiness = (e) =>
  e.business && (e.business.status !== 'LIVE' || e.business.deletedAt)
    ? { ...e, business: null }
    : e

/**
 * Approved events still on or after `from` (default: today in Kathmandu), soonest first.
 * Keyset on (startsAt, id); an event that started earlier but has not ended is included.
 */
export async function listEvents({ from, to, area, cursor, limit }) {
  const since = from ?? nepalDayStart()
  const after = decodeCursor(cursor, eventCursor)
  const rows = await readDb.event.findMany({
    where: {
      status: 'APPROVED',
      AND: [
        { OR: [{ startsAt: { gte: since } }, { endsAt: { gte: since } }] },
        ...(to ? [{ startsAt: { lte: to } }] : []),
        ...(after
          ? [
              {
                OR: [
                  { startsAt: { gt: new Date(after[0]) } },
                  { startsAt: new Date(after[0]), id: { gt: after[1] } },
                ],
              },
            ]
          : []),
      ],
      ...(area && { area: { slug: area } }),
    },
    orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    take: limit + 1,
    include: eventInclude,
  })
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return {
    items: page.map((e) => eventCard(withLiveBusiness(e))),
    nextCursor: rows.length > limit ? encodeCursor([last.startsAt.getTime(), last.id]) : null,
  }
}

/** Approved event with its map pin, or null. */
export async function getEvent(slug) {
  const event = await readDb.event.findFirst({
    where: { slug, status: 'APPROVED' },
    include: eventInclude,
  })
  if (!event) return null
  const [point] = await readDb.$queryRaw`
    SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM events WHERE id = ${event.id}::uuid AND location IS NOT NULL`
  return {
    ...eventCard(withLiveBusiness(event)),
    description: event.description,
    ticketUrl: event.ticketUrl,
    location: point ?? null,
  }
}

const eventSlugTaken = (client) => async (candidate) =>
  (await client.event.count({ where: { slug: candidate } })) > 0

/** Creates a PENDING event (slug from title and date). Pass the transaction client. */
export async function createEvent(tx, { location, ...data }, { submittedById, businessId }) {
  const date = data.startsAt.toISOString().slice(0, 10)
  const slug = await uniqueSlug(`${data.title} ${date}`, eventSlugTaken(tx), 'event')
  const event = await tx.event.create({
    data: { ...data, slug, submittedById, businessId: businessId ?? null, status: 'PENDING' },
  })
  if (location) await setEventLocation(tx, event.id, location)
  return event
}

/** Owner and member view of their own submissions. */
export const mySubmission = (e) => ({
  ...eventCard(withLiveBusiness(e)),
  status: e.status,
  createdAt: e.createdAt,
})

/** After an event is approved, edited or removed: purge the API cache and the pages. */
export function afterEventChange(events) {
  const pageTags = new Set(['events', 'home'])
  for (const e of events)
    for (const v of [e.id, e.slug, e.oldSlug]) if (v) pageTags.add(`event:${v}`)
  return queueContentChange({
    cacheTags: ['events', 'home', ...events.map((e) => `event:${e.id}`)],
    pageTags: [...pageTags],
  })
}
