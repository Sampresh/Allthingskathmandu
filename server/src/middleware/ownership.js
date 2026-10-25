import { z } from 'zod'
import { db } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'

const uuid = z.uuid()

/**
 * For /business/listings/:id routes: the listing must exist and belong to req.user.
 * Answers 404 either way so other owners' listings are not revealed. Sets req.listing.
 */
export async function requireOwnership(req, res, next) {
  const id = req.params.id
  if (!uuid.safeParse(id).success) throw ApiError.notFound('Listing not found')

  const listing = await db.business.findFirst({
    where: { id, ownerId: req.user.id, deletedAt: null },
  })
  if (!listing) throw ApiError.notFound('Listing not found')

  req.listing = listing
  next()
}
