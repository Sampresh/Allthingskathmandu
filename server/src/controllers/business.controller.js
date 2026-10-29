import { db } from '../config/db.js'
import { nepalClock } from '../lib/hours.js'
import { audit, changedFields } from '../services/audit.js'
import { setBusinessLocation } from '../services/geo.js'
import { afterListingChange, categoryIdsOf, updateListing } from '../services/listings.js'
import * as media from '../services/listingMedia.js'
import { confirmUpload, queueMediaDelete, signUpload } from '../services/media.js'
import { activeSubscription, requireFeatured } from '../services/subscriptions.js'
import { ApiError } from '../utils/ApiError.js'
import { created, ok } from '../utils/ApiResponse.js'

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_STATS_DAYS = 365
const STAT_FIELDS = ['views', 'calls', 'whatsapp', 'mapClicks', 'websiteClicks']

// req.listing is set (and owned by req.user) by requireOwnership on every :id route.
const changed = async (req, oldSlug) =>
  afterListingChange({ ...req.listing, oldSlug }, await categoryIdsOf(db, req.listing.id))

async function ownerDetail(id) {
  const listing = await db.business.findUnique({
    where: { id },
    include: {
      area: true,
      categories: { orderBy: { isPrimary: 'desc' }, include: { category: true } },
      tags: { include: { tag: true } },
      media: { orderBy: { sortOrder: 'asc' } },
    },
  })
  const [location] = await db.$queryRaw`
    SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM businesses WHERE id = ${id}::uuid AND location IS NOT NULL`
  const subscription = await activeSubscription(id)
  return {
    ...listing,
    location: location ?? null,
    categoryIds: listing.categories.map((c) => c.categoryId),
    tagIds: listing.tags.map((t) => t.tagId),
    plan: subscription
      ? {
          code: subscription.plan.code,
          name: subscription.plan.name,
          endsAt: subscription.endsAt,
          features: subscription.plan.features,
        }
      : null,
  }
}

// ---------- Listings ----------

export async function myListings(req, res) {
  const listings = await db.business.findMany({
    where: { ownerId: req.user.id, deletedAt: null },
    orderBy: { name: 'asc' },
    select: { id: true, slug: true, name: true, status: true, logoUrl: true, featuredUntil: true },
  })
  // Last 30 days of activity per listing, for the dashboard.
  const since = new Date(Date.now() - 30 * DAY_MS)
  const totals = listings.length
    ? await db.listingStatDaily.groupBy({
        by: ['businessId'],
        where: { businessId: { in: listings.map((l) => l.id) }, date: { gte: since } },
        _sum: Object.fromEntries(STAT_FIELDS.map((f) => [f, true])),
      })
    : []
  const byId = new Map(totals.map((t) => [t.businessId, t._sum]))
  return ok(
    res,
    listings.map((l) => ({
      ...l,
      last30Days: Object.fromEntries(STAT_FIELDS.map((f) => [f, byId.get(l.id)?.[f] ?? 0])),
    })),
  )
}

export async function getListing(req, res) {
  return ok(res, await ownerDetail(req.listing.id))
}

export async function updateListingDetails(req, res) {
  const { logoPublicId, ...fields } = req.body
  const before = await ownerDetail(req.listing.id)
  const patch = { ...fields }

  if (logoPublicId !== undefined) {
    if (logoPublicId === null) {
      patch.logoUrl = null
      patch.logoPublicId = null
    } else {
      const upload = await confirmUpload({
        publicId: logoPublicId,
        scope: 'listings',
        id: req.listing.id,
        kind: 'logo',
      })
      patch.logoUrl = upload.url
      patch.logoPublicId = upload.publicId
    }
  }

  await db.$transaction(async (tx) => {
    await updateListing(tx, req.listing.id, patch)
    await audit(tx, req, {
      action: 'business.owner_update',
      entity: 'business',
      entityId: req.listing.id,
      diff: changedFields(before, patch),
    })
  })
  if (
    patch.logoPublicId !== undefined &&
    before.logoPublicId &&
    before.logoPublicId !== patch.logoPublicId
  ) {
    await queueMediaDelete(before.logoPublicId)
  }
  await afterListingChange(req.listing, [
    ...new Set([...before.categoryIds, ...(fields.categoryIds ?? [])]),
  ])
  return ok(res, await ownerDetail(req.listing.id))
}

export async function signLogo(req, res) {
  return ok(res, signUpload({ scope: 'listings', id: req.listing.id, kind: 'logo' }))
}

export async function putHours(req, res) {
  await db.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: req.listing.id },
      data: { hours: req.body.hours ?? null },
    })
    await audit(tx, req, {
      action: 'business.hours',
      entity: 'business',
      entityId: req.listing.id,
      diff: { hours: req.body.hours },
    })
  })
  await changed(req)
  return ok(res, { hours: req.body.hours })
}

export async function putLocation(req, res) {
  const { lat, lng, address, areaId } = req.body
  if (areaId && !(await db.area.findUnique({ where: { id: areaId } })))
    throw ApiError.badRequest('Unknown area')
  await db.$transaction(async (tx) => {
    await tx.business.update({
      where: { id: req.listing.id },
      data: { ...(address !== undefined && { address }), ...(areaId !== undefined && { areaId }) },
    })
    if (lat !== undefined && lng !== undefined)
      await setBusinessLocation(tx, req.listing.id, { lat, lng })
    await audit(tx, req, {
      action: 'business.location',
      entity: 'business',
      entityId: req.listing.id,
      diff: req.body,
    })
  })
  await changed(req)
  return ok(res, await ownerDetail(req.listing.id))
}

// ---------- Media (Featured only) ----------

export async function signMedia(req, res) {
  await media.assertPhotoRoom(req.listing.id, await requireFeatured(req.listing.id))
  return ok(res, signUpload({ scope: 'listings', id: req.listing.id, kind: 'photo' }))
}

export async function addMedia(req, res) {
  const row = await media.addMedia(
    req,
    req.listing.id,
    req.body,
    await requireFeatured(req.listing.id),
  )
  await changed(req)
  return created(res, row)
}

export async function reorderMedia(req, res) {
  const result = await media.reorderMedia(req, req.listing.id, req.body.ids)
  await changed(req)
  return ok(res, result)
}

export async function deleteMedia(req, res) {
  const result = await media.deleteMedia(req, req.listing.id, req.params.mediaId)
  await changed(req)
  return ok(res, result)
}

// ---------- Offers (Featured only to list and create) ----------

export async function listOffers(req, res) {
  await requireFeatured(req.listing.id)
  return ok(
    res,
    await db.offer.findMany({ where: { businessId: req.listing.id }, orderBy: { endsAt: 'desc' } }),
  )
}

export async function createOffer(req, res) {
  await requireFeatured(req.listing.id)
  const offer = await db.$transaction(async (tx) => {
    const row = await tx.offer.create({ data: { ...req.body, businessId: req.listing.id } })
    await audit(tx, req, {
      action: 'offer.create',
      entity: 'offer',
      entityId: row.id,
      diff: { title: row.title },
    })
    return row
  })
  await changed(req)
  return created(res, offer)
}

async function ownedOffer(req) {
  const offer = await db.offer.findFirst({
    where: { id: req.params.offerId, businessId: req.listing.id },
  })
  if (!offer) throw ApiError.notFound('Offer not found')
  return offer
}

export async function updateOffer(req, res) {
  const before = await ownedOffer(req)
  const next = { ...before, ...req.body }
  if (next.endsAt <= next.startsAt)
    throw ApiError.validation([{ path: 'endsAt', message: 'Must end after it starts' }])
  const offer = await db.$transaction(async (tx) => {
    const row = await tx.offer.update({ where: { id: before.id }, data: req.body })
    await audit(tx, req, {
      action: 'offer.update',
      entity: 'offer',
      entityId: row.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  await changed(req)
  return ok(res, offer)
}

export async function deleteOffer(req, res) {
  const offer = await ownedOffer(req)
  await db.$transaction(async (tx) => {
    await tx.offer.delete({ where: { id: offer.id } })
    await audit(tx, req, {
      action: 'offer.delete',
      entity: 'offer',
      entityId: offer.id,
      diff: { title: offer.title },
    })
  })
  await changed(req)
  return ok(res, { deleted: true })
}

// ---------- Stats, plan, invoices ----------

const isoDay = (date) => date.toISOString().slice(0, 10)

/** Daily views and clicks (Nepal dates), every day in the range, zeros included. */
export async function stats(req, res) {
  const today = nepalClock().date
  const to = req.query.to ?? today
  const from = req.query.from ?? isoDay(new Date(Date.parse(to) - 29 * DAY_MS))
  const days = Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS) + 1
  if (days < 1) throw ApiError.validation([{ path: 'from', message: 'Must be on or before "to"' }])
  if (days > MAX_STATS_DAYS)
    throw ApiError.validation([{ path: 'from', message: `At most ${MAX_STATS_DAYS} days` }])

  const rows = await db.listingStatDaily.findMany({
    where: { businessId: req.listing.id, date: { gte: new Date(from), lte: new Date(to) } },
  })
  const byDay = new Map(rows.map((r) => [isoDay(r.date), r]))
  const series = Array.from({ length: days }, (_, i) => {
    const date = isoDay(new Date(Date.parse(from) + i * DAY_MS))
    const row = byDay.get(date)
    return { date, ...Object.fromEntries(STAT_FIELDS.map((f) => [f, row?.[f] ?? 0])) }
  })
  const totals = Object.fromEntries(
    STAT_FIELDS.map((f) => [f, series.reduce((sum, d) => sum + d[f], 0)]),
  )
  return ok(res, { from, to, days: series, totals })
}

export async function subscription(req, res) {
  const [current, history] = await Promise.all([
    activeSubscription(req.listing.id),
    db.subscription.findMany({
      where: { businessId: req.listing.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { plan: { select: { code: true, name: true } } },
    }),
  ])
  return ok(res, {
    current: current
      ? { id: current.id, plan: current.plan, startsAt: current.startsAt, endsAt: current.endsAt }
      : null,
    history,
  })
}

export async function invoices(req, res) {
  const payments = await db.payment.findMany({
    where: { businessId: req.listing.id, status: 'COMPLETED' },
    orderBy: { verifiedAt: 'desc' },
    select: {
      id: true,
      invoiceNo: true,
      amountNpr: true,
      gateway: true,
      verifiedAt: true,
      subscription: { select: { startsAt: true, endsAt: true, plan: { select: { name: true } } } },
    },
  })
  return ok(res, payments)
}
