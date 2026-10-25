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

const DAY_MS = 24 * 60 * 60 * 1000

const invoiceNumber = (paymentId, at) =>
  `ATK-${at.toISOString().slice(0, 10).replace(/-/g, '')}-${paymentId.replace(/-/g, '').slice(-8).toUpperCase()}`

/**
 * Starts a paid plan: PENDING subscription + INITIATED payment. gatewayRef is replaced by the
 * gateway's own reference (Khalti pidx) when it is known.
 */
export function createPendingPurchase({ businessId, plan, gateway }) {
  return db.$transaction(async (tx) => {
    const subscription = await tx.subscription.create({
      data: { businessId, planId: plan.id, status: 'PENDING' },
    })
    const payment = await tx.payment.create({
      data: {
        subscriptionId: subscription.id,
        businessId,
        gateway,
        gatewayRef: `pending-${subscription.id}`,
        amountNpr: plan.priceNpr,
      },
    })
    return { subscription, payment }
  })
}

/**
 * Activates a verified payment in one transaction: payment COMPLETED with an invoice number,
 * subscription ACTIVE (a renewal starts when the current period ends), featuredUntil set, and
 * an audit row. Only the first call for a payment does anything (idempotent per gatewayRef).
 * Returns { activated, payment }.
 */
export async function activatePayment({ paymentId, raw, actorId, ip }) {
  return db.$transaction(async (tx) => {
    const now = new Date()
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: 'INITIATED' },
      data: { status: 'COMPLETED', verifiedAt: now, raw, invoiceNo: invoiceNumber(paymentId, now) },
    })
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: { subscription: { include: { plan: true } } },
    })
    if (count === 0) return { activated: false, payment }

    const { subscription } = payment
    const current = await tx.subscription.findFirst({
      where: { businessId: payment.businessId, status: 'ACTIVE', endsAt: { gt: now } },
      orderBy: { endsAt: 'desc' },
    })
    const startsAt = current ? current.endsAt : now
    const endsAt = new Date(startsAt.getTime() + subscription.plan.durationDays * DAY_MS)
    await tx.subscription.update({
      where: { id: subscription.id },
      data: { status: 'ACTIVE', startsAt, endsAt },
    })

    const business = await tx.business.findUnique({ where: { id: payment.businessId } })
    if (
      subscription.plan.features?.featured &&
      (!business.featuredUntil || business.featuredUntil < endsAt)
    ) {
      await tx.business.update({ where: { id: business.id }, data: { featuredUntil: endsAt } })
    }
    await tx.auditLog.create({
      data: {
        actorId,
        action: 'subscription.activate',
        entity: 'subscription',
        entityId: subscription.id,
        diff: {
          paymentId,
          plan: subscription.plan.code,
          amountNpr: payment.amountNpr,
          startsAt,
          endsAt,
        },
        ip,
      },
    })
    return {
      activated: true,
      payment: await tx.payment.findUnique({
        where: { id: paymentId },
        include: { subscription: { include: { plan: true } } },
      }),
    }
  })
}

/** Marks an unpaid attempt failed (gateway said expired, cancelled or wrong amount). */
export function failPayment(paymentId, raw) {
  return db.$transaction(async (tx) => {
    const { count } = await tx.payment.updateMany({
      where: { id: paymentId, status: 'INITIATED' },
      data: { status: 'FAILED', raw },
    })
    if (count) {
      const payment = await tx.payment.findUnique({ where: { id: paymentId } })
      await tx.subscription.updateMany({
        where: { id: payment.subscriptionId, status: 'PENDING' },
        data: { status: 'CANCELLED' },
      })
    }
  })
}
