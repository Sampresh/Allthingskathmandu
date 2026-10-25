import { db } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'

/**
 * The listing's live paid subscription, if any. Paid features are always checked against a
 * subscriptions row, never the JWT (CLAUDE.md security defaults).
 */
export function activeSubscription(businessId, client = db) {
  return client.subscription.findFirst({
    where: { businessId, status: 'ACTIVE', endsAt: { gt: new Date() } },
    include: { plan: true },
    orderBy: { endsAt: 'desc' },
  })
}

/** Throws unless the listing has an active plan with Featured features. Returns its features. */
export async function requireFeatured(businessId) {
  const subscription = await activeSubscription(businessId)
  if (!subscription?.plan.features?.featured) {
    throw ApiError.forbidden(
      'Photos, videos and offers come with the Featured plan',
      'FEATURED_REQUIRED',
    )
  }
  return subscription.plan.features
}
