import bcrypt from 'bcryptjs'
import { Prisma } from '../generated/prisma/client'
import { clearAuthCookies } from '../config/cookies.js'
import { db, readDb } from '../config/db.js'
import { decodeCursor, encodeCursor, idPage, keysetSchema } from '../lib/cursor.js'
import { isStaff } from '../middleware/requireRole.js'
import { audit } from '../services/audit.js'
import { cardStream, liveSql, toCard } from '../services/directory.js'
import { afterListingChange, categoryIdsOf, createListing } from '../services/listings.js'
import { afterItemChange, dropPhotos } from '../services/market.js'
import { confirmUpload, signUpload } from '../services/media.js'
import { recomputeRating } from '../services/reviews.js'
import { revokeAllSessions, revokeSession } from '../services/token.js'
import { ApiError } from '../utils/ApiError.js'
import { created, noContent, ok } from '../utils/ApiResponse.js'
import { BCRYPT_COST, publicUser } from './auth.controller.js'

// ---------- Claims ----------

export async function signClaimProof(req, res) {
  return ok(res, signUpload({ scope: 'claims', id: req.user.id, kind: 'proof' }))
}

/** Claim an existing (live) listing with phone or document proof; Admin approves. */
export async function createClaim(req, res) {
  const { businessId, note, proofPublicId } = req.body
  const listing = await db.business.findFirst({
    where: { id: businessId, status: 'LIVE', deletedAt: null },
  })
  if (!listing) throw ApiError.notFound('Listing not found')
  if (listing.ownerId === req.user.id) throw ApiError.conflict('You already manage this listing')
  if (listing.ownerId)
    throw ApiError.conflict('This listing is already managed. Contact us if that is wrong.')
  if (await db.claim.findFirst({ where: { businessId, userId: req.user.id, status: 'PENDING' } })) {
    throw ApiError.conflict('Your claim for this listing is waiting for review')
  }

  const proof = proofPublicId
    ? await confirmUpload({
        publicId: proofPublicId,
        scope: 'claims',
        id: req.user.id,
        kind: 'proof',
      })
    : null
  const claim = await db.$transaction(async (tx) => {
    const row = await tx.claim.create({
      data: { businessId, userId: req.user.id, note: note ?? null, proofUrl: proof?.url ?? null },
    })
    await audit(tx, req, {
      action: 'claim.create',
      entity: 'claim',
      entityId: row.id,
      diff: { businessId },
    })
    return row
  })
  return created(res, claim)
}

export async function myClaims(req, res) {
  return ok(
    res,
    await db.claim.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        createdAt: true,
        reviewedAt: true,
        business: { select: { id: true, name: true, slug: true } },
      },
    }),
  )
}

// ---------- "List your business" ----------

/** A new listing waits as PENDING; when Admin sets it LIVE the member becomes its owner. */
export async function createPendingListing(req, res) {
  const listing = await db.$transaction(async (tx) => {
    const row = await createListing(tx, {
      ...req.body,
      type: 'BUSINESS',
      status: 'PENDING',
      ownerId: req.user.id,
    })
    await audit(tx, req, {
      action: 'business.submit',
      entity: 'business',
      entityId: row.id,
      diff: { name: row.name },
    })
    return row
  })
  return created(res, { id: listing.id, name: listing.name, status: listing.status })
}

// ---------- Profile ----------

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  avatarUrl: true,
  emailVerifiedAt: true,
  totpEnabled: true,
  passwordHash: true,
  googleId: true,
  createdAt: true,
}

const profile = (user) => ({
  ...publicUser(user),
  phone: user.phone,
  hasPassword: Boolean(user.passwordHash),
  googleLinked: Boolean(user.googleId),
  createdAt: user.createdAt,
})

export async function getProfile(req, res) {
  return ok(
    res,
    profile(await db.user.findUnique({ where: { id: req.user.id }, select: PROFILE_SELECT })),
  )
}

export async function updateProfile(req, res) {
  try {
    const user = await db.user.update({
      where: { id: req.user.id },
      data: req.body,
      select: PROFILE_SELECT,
    })
    return ok(res, profile(user))
  } catch (err) {
    if (err.code === 'P2002') {
      throw ApiError.conflict('That phone number is used by another account', [
        { path: 'phone', message: 'That phone number is used by another account' },
      ])
    }
    throw err
  }
}

const wrongPassword = (path) =>
  new ApiError(400, 'INVALID_PASSWORD', 'Your current password is incorrect', [
    { path, message: 'Your current password is incorrect' },
  ])

/** Accounts with a password must confirm it; Google-only accounts have none to confirm. */
async function assertPassword(user, given, path) {
  if (!user.passwordHash) return
  if (!given || !(await bcrypt.compare(given, user.passwordHash))) throw wrongPassword(path)
}

export async function changePassword(req, res) {
  const user = await db.user.findUnique({ where: { id: req.user.id } })
  await assertPassword(user, req.body.currentPassword, 'currentPassword')
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(req.body.newPassword, BCRYPT_COST) },
  })
  await revokeAllSessions(user.id, { exceptSessionId: req.auth.sessionId })
  return ok(res, { message: 'Password changed. Your other devices have been signed out.' })
}

// ---------- Sessions (devices) ----------

export async function listSessions(req, res) {
  const sessions = await db.session.findMany({
    where: { userId: req.user.id, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, userAgent: true, ip: true, createdAt: true, expiresAt: true },
  })
  return ok(
    res,
    sessions.map((s) => ({ ...s, current: s.id === req.auth.sessionId })),
  )
}

export async function endSession(req, res) {
  const session = await db.session.findFirst({
    where: { id: req.params.id, userId: req.user.id, revokedAt: null },
  })
  if (!session) throw ApiError.notFound('Session not found')
  await revokeSession(session.id)
  if (session.id === req.auth.sessionId) clearAuthCookies(res)
  return noContent(res)
}

// ---------- Account deletion ----------

/**
 * Soft delete: personal data is cleared and the email freed for a new account. Reviews stay,
 * shown as "Former member"; owned listings go back to unclaimed (paid plans stay with them);
 * market items are removed.
 */
export async function deleteAccount(req, res) {
  const user = await db.user.findUnique({ where: { id: req.user.id } })
  if (isStaff(user.role)) {
    throw ApiError.forbidden(
      'Staff accounts cannot be deleted here. Ask a super admin to remove your staff role first.',
      'STAFF_ACCOUNT',
    )
  }
  await assertPassword(user, req.body.password, 'password')

  const [owned, reviewed, items] = await Promise.all([
    db.business.findMany({ where: { ownerId: user.id }, select: { id: true, slug: true } }),
    db.review.findMany({
      where: { userId: user.id, status: 'APPROVED' },
      select: { business: { select: { id: true, slug: true } } },
    }),
    db.marketItem.findMany({
      where: { sellerId: user.id, deletedAt: null },
      select: { id: true, slug: true, status: true, media: { select: { publicId: true } } },
    }),
  ])
  const now = new Date()
  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: user.id },
      data: {
        deletedAt: now,
        email: `deleted-${user.id}@deleted.invalid`,
        name: 'Former member',
        phone: null,
        avatarUrl: null,
        passwordHash: null,
        googleId: null,
        totpSecret: null,
        totpEnabled: false,
        failedLogins: 0,
        lockedUntil: null,
      },
    })
    await tx.session.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: now },
    })
    await tx.verificationToken.deleteMany({ where: { userId: user.id } })
    await tx.savedListing.deleteMany({ where: { userId: user.id } })
    await tx.claim.updateMany({
      where: { userId: user.id, status: 'PENDING' },
      data: { status: 'REJECTED', reviewedAt: now },
    })
    await tx.business.updateMany({ where: { ownerId: user.id }, data: { ownerId: null } })
    // Market items carry the member's phone numbers: they come down with the account.
    await tx.marketItemMedia.deleteMany({ where: { item: { sellerId: user.id } } })
    await tx.marketItem.updateMany({
      where: { sellerId: user.id, deletedAt: null },
      data: { deletedAt: now },
    })
    await audit(tx, req, { action: 'user.delete', entity: 'user', entityId: user.id })
  })
  clearAuthCookies(res)
  await dropPhotos(items.flatMap((i) => i.media.map((m) => m.publicId)))
  const liveItems = items.filter((i) => i.status === 'LIVE')
  if (liveItems.length) await afterItemChange(liveItems)

  // Listing pages show the claim link again and the reviews as "Former member".
  const listings = new Map([...owned, ...reviewed.map((r) => r.business)].map((l) => [l.id, l]))
  for (const listing of listings.values()) {
    await afterListingChange(listing, await categoryIdsOf(db, listing.id))
  }
  return noContent(res)
}

// ---------- Saved listings ----------

export async function listSaved(req, res) {
  const { cursor, limit, businessId } = req.query
  const rows = await cardStream({
    where: businessId ? Prisma.sql`${liveSql} AND b.id = ${businessId}::uuid` : liveSql,
    from: Prisma.sql`JOIN saved_listings sl ON sl."businessId" = b.id AND sl."userId" = ${req.user.id}::uuid`,
    // Newest first: the keyset runs ascending, so sort on the negated save time.
    sortKey: Prisma.sql`-extract(epoch from sl."createdAt")`,
    after: decodeCursor(cursor, keysetSchema),
    limit: limit + 1,
  })
  const page = rows.slice(0, limit)
  const last = page.at(-1)
  return ok(
    res,
    page.map((row) => toCard(row)),
    {
      nextCursor: rows.length > limit ? encodeCursor([last.sortKey, last.id]) : null,
    },
  )
}

async function liveListing(id) {
  const listing = await db.business.findFirst({
    where: { id, status: 'LIVE', deletedAt: null },
    select: { id: true, slug: true, ownerId: true },
  })
  if (!listing) throw ApiError.notFound('Listing not found')
  return listing
}

export async function saveListing(req, res) {
  const { id } = await liveListing(req.params.businessId)
  await db.savedListing.createMany({
    data: [{ userId: req.user.id, businessId: id }],
    skipDuplicates: true,
  })
  return ok(res, { businessId: id, saved: true })
}

export async function unsaveListing(req, res) {
  await db.savedListing.deleteMany({
    where: { userId: req.user.id, businessId: req.params.businessId },
  })
  return ok(res, { businessId: req.params.businessId, saved: false })
}

// ---------- Reviews ----------

const myReview = (r) => ({
  id: r.id,
  rating: r.rating,
  body: r.body,
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
  listing: {
    id: r.business.id,
    slug: r.business.slug,
    name: r.business.name,
    live: r.business.status === 'LIVE' && !r.business.deletedAt,
  },
})

const reviewInclude = {
  business: { select: { id: true, slug: true, name: true, status: true, deletedAt: true } },
}

export async function myReviews(req, res) {
  const page = idPage(req.query.cursor, req.query.limit)
  const rows = await readDb.review.findMany({
    where: { userId: req.user.id, ...page.where },
    orderBy: page.orderBy,
    take: page.take,
    include: reviewInclude,
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items.map(myReview), { nextCursor })
}

/** One review per member per listing; every new or edited review waits for moderation. */
export async function createReview(req, res) {
  const { businessId, rating, body } = req.body
  const listing = await liveListing(businessId)
  if (listing.ownerId === req.user.id)
    throw ApiError.forbidden('You cannot review your own listing')
  try {
    const review = await db.review.create({
      data: { businessId, userId: req.user.id, rating, body: body ?? null },
      include: reviewInclude,
    })
    return created(res, myReview(review))
  } catch (err) {
    if (err.code === 'P2002') {
      throw new ApiError(
        409,
        'ALREADY_REVIEWED',
        'You have already reviewed this listing. Edit your review instead.',
      )
    }
    throw err
  }
}

async function ownReview(req) {
  const review = await db.review.findFirst({
    where: { id: req.params.id, userId: req.user.id },
    include: reviewInclude,
  })
  if (!review) throw ApiError.notFound('Review not found')
  return review
}

/** An approved review leaves the listing's rating until it is approved again. */
async function afterReviewChange(review) {
  if (review.status !== 'APPROVED') return
  await afterListingChange(review.business, await categoryIdsOf(db, review.businessId))
}

export async function updateReview(req, res) {
  const before = await ownReview(req)
  const review = await db.$transaction(async (tx) => {
    const row = await tx.review.update({
      where: { id: before.id },
      data: { ...req.body, status: 'PENDING' },
      include: reviewInclude,
    })
    if (before.status === 'APPROVED') await recomputeRating(tx, before.businessId)
    return row
  })
  await afterReviewChange(before)
  return ok(res, myReview(review))
}

export async function deleteReview(req, res) {
  const review = await ownReview(req)
  await db.$transaction(async (tx) => {
    await tx.review.delete({ where: { id: review.id } })
    if (review.status === 'APPROVED') await recomputeRating(tx, review.businessId)
  })
  await afterReviewChange(review)
  return noContent(res)
}
