import { db } from '../config/db.js'
import { audit } from '../services/audit.js'
import { createListing } from '../services/listings.js'
import { confirmUpload, signUpload } from '../services/media.js'
import { ApiError } from '../utils/ApiError.js'
import { created, ok } from '../utils/ApiResponse.js'

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
