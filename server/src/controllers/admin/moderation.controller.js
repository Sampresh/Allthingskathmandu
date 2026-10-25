import { db, readDb } from '../../config/db.js'
import { idPage } from '../../lib/cursor.js'
import { audit } from '../../services/audit.js'
import { clientUrl, queueEmail } from '../../services/email.js'
import { afterListingChange, categoryIdsOf } from '../../services/listings.js'
import { recomputeRating } from '../../services/reviews.js'
import { ApiError } from '../../utils/ApiError.js'
import { ok } from '../../utils/ApiResponse.js'

const listingSummary = { select: { id: true, slug: true, name: true, ownerId: true, phone: true } }
const userSummary = { select: { id: true, name: true, email: true, phone: true } }

// ---------- Claims ----------

export async function listClaims(req, res) {
  const { status, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.claim.findMany({
    where: { status, ...page.where },
    orderBy: page.orderBy,
    take: page.take,
    include: { business: listingSummary, user: userSummary },
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

async function pendingClaim(id) {
  const claim = await db.claim.findUnique({
    where: { id },
    include: { business: true, user: true },
  })
  if (!claim) throw ApiError.notFound('Claim not found')
  if (claim.status !== 'PENDING') throw ApiError.conflict('This claim was already decided')
  return claim
}

/** Gives the listing to the claimant (a member becomes a business owner). */
export async function approveClaim(req, res) {
  const claim = await pendingClaim(req.params.id)
  const now = new Date()
  await db.$transaction(async (tx) => {
    await tx.claim.update({
      where: { id: claim.id },
      data: { status: 'APPROVED', reviewedById: req.user.id, reviewedAt: now },
    })
    // Other pending claims for the same listing are closed.
    await tx.claim.updateMany({
      where: { businessId: claim.businessId, status: 'PENDING', id: { not: claim.id } },
      data: { status: 'REJECTED', reviewedById: req.user.id, reviewedAt: now },
    })
    await tx.business.update({ where: { id: claim.businessId }, data: { ownerId: claim.userId } })
    if (claim.user.role === 'MEMBER') {
      await tx.user.update({ where: { id: claim.userId }, data: { role: 'BUSINESS_OWNER' } })
    }
    await audit(tx, req, {
      action: 'claim.approve',
      entity: 'claim',
      entityId: claim.id,
      diff: {
        businessId: claim.businessId,
        ownerId: { from: claim.business.ownerId, to: claim.userId },
      },
    })
  })
  await queueEmail(claim.user.email, 'claim-approved', {
    name: claim.user.name,
    listingName: claim.business.name,
    url: clientUrl('/business/dashboard'),
  })
  return ok(res, { id: claim.id, status: 'APPROVED' })
}

export async function rejectClaim(req, res) {
  const claim = await pendingClaim(req.params.id)
  await db.$transaction(async (tx) => {
    await tx.claim.update({
      where: { id: claim.id },
      data: { status: 'REJECTED', reviewedById: req.user.id, reviewedAt: new Date() },
    })
    await audit(tx, req, {
      action: 'claim.reject',
      entity: 'claim',
      entityId: claim.id,
      diff: { reason: req.body.reason ?? null },
    })
  })
  await queueEmail(claim.user.email, 'claim-rejected', {
    name: claim.user.name,
    listingName: claim.business.name,
    reason: req.body.reason ?? null,
  })
  return ok(res, { id: claim.id, status: 'REJECTED' })
}

// ---------- Reviews ----------

export async function listReviews(req, res) {
  const { status, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.review.findMany({
    where: { status, ...page.where },
    orderBy: page.orderBy,
    take: page.take,
    include: { business: listingSummary, user: userSummary },
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

async function decideReview(req, res, status) {
  const review = await db.review.findUnique({
    where: { id: req.params.id },
    include: { business: true },
  })
  if (!review) throw ApiError.notFound('Review not found')
  await db.$transaction(async (tx) => {
    await tx.review.update({ where: { id: review.id }, data: { status } })
    await recomputeRating(tx, review.businessId)
    await audit(tx, req, {
      action: status === 'APPROVED' ? 'review.approve' : 'review.reject',
      entity: 'review',
      entityId: review.id,
      diff: { status: { from: review.status, to: status } },
    })
  })
  // Rating and the review list show on the listing page and its cards.
  await afterListingChange(review.business, await categoryIdsOf(db, review.businessId))
  return ok(res, { id: review.id, status })
}

export const approveReview = (req, res) => decideReview(req, res, 'APPROVED')
export const rejectReview = (req, res) => decideReview(req, res, 'REJECTED')

// ---------- Reports ----------

const REPORT_TARGETS = {
  BUSINESS: (ids) =>
    readDb.business.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, slug: true },
    }),
  REVIEW: (ids) =>
    readDb.review.findMany({
      where: { id: { in: ids } },
      select: { id: true, body: true, rating: true },
    }),
  MARKET_ITEM: (ids) =>
    readDb.marketItem.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, slug: true },
    }),
  EVENT: (ids) =>
    readDb.event.findMany({
      where: { id: { in: ids } },
      select: { id: true, title: true, slug: true },
    }),
}

export async function listReports(req, res) {
  const { status, entityType, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.report.findMany({
    where: { status, ...(entityType && { entityType }), ...page.where },
    orderBy: page.orderBy,
    take: page.take,
  })
  const { items, nextCursor } = page.finish(rows)

  // Attach what each report is about, one query per entity type.
  const targets = new Map()
  for (const type of new Set(items.map((r) => r.entityType))) {
    const found = await REPORT_TARGETS[type](
      items.filter((r) => r.entityType === type).map((r) => r.entityId),
    )
    found.forEach((t) => targets.set(`${type}:${t.id}`, t))
  }
  return ok(
    res,
    items.map((r) => ({ ...r, target: targets.get(`${r.entityType}:${r.entityId}`) ?? null })),
    { nextCursor },
  )
}

export async function updateReport(req, res) {
  const report = await db.report.findUnique({ where: { id: req.params.id } })
  if (!report) throw ApiError.notFound('Report not found')
  const updated = await db.$transaction(async (tx) => {
    const row = await tx.report.update({
      where: { id: report.id },
      data: { status: req.body.status, handledById: req.user.id },
    })
    await audit(tx, req, {
      action: 'report.update',
      entity: 'report',
      entityId: report.id,
      diff: { status: { from: report.status, to: req.body.status } },
    })
    return row
  })
  return ok(res, updated)
}
