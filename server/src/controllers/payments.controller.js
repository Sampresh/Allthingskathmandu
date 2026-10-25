import { db } from '../config/db.js'
import {
  checkEsewa,
  decodeEsewaResponse,
  esewaAmount,
  esewaForm,
  requireEsewa,
} from '../services/payments/esewa.js'
import { initiateKhalti, lookupKhalti, requireKhalti } from '../services/payments/khalti.js'
import { afterListingChange, categoryIdsOf } from '../services/listings.js'
import { activatePayment, createPendingPurchase, failPayment } from '../services/subscriptions.js'
import { ApiError } from '../utils/ApiError.js'
import { created, ok } from '../utils/ApiResponse.js'
import { logger } from '../utils/logger.js'

/** The caller's listing and the active, paid plan; the price comes from `plans` only. */
async function purchaseTarget(req) {
  const { businessId, planCode } = req.body
  const listing = await db.business.findFirst({
    where: { id: businessId, ownerId: req.user.id, deletedAt: null },
  })
  if (!listing) throw ApiError.notFound('Listing not found')
  const plan = await db.plan.findUnique({ where: { code: planCode } })
  if (!plan?.isActive || plan.priceNpr <= 0) throw ApiError.badRequest('That plan is not for sale')
  return { listing, plan }
}

/** Payment by gateway reference, only for the caller's own listing. */
async function ownPayment(req, gateway, gatewayRef) {
  const payment = await db.payment.findFirst({
    where: { gateway, gatewayRef, business: { ownerId: req.user.id } },
    include: { business: true, subscription: { include: { plan: true } } },
  })
  if (!payment) throw ApiError.notFound('Payment not found')
  return payment
}

const summary = (payment) => ({
  listingId: payment.businessId,
  status: payment.status,
  invoiceNo: payment.invoiceNo,
  amountNpr: payment.amountNpr,
  plan: payment.subscription.plan.name,
  startsAt: payment.subscription.startsAt,
  endsAt: payment.subscription.endsAt,
})

/** Applies a gateway verdict: activate once, keep pending, or fail. */
async function settle(req, res, payment, { outcome, raw }) {
  if (outcome === 'paid') {
    const { activated, payment: settled } = await activatePayment({
      paymentId: payment.id,
      raw,
      actorId: req.user.id,
      ip: req.ip,
    })
    // Featured placement shows on category pages, the homepage and the listing page.
    if (activated)
      await afterListingChange(payment.business, await categoryIdsOf(db, payment.businessId))
    return ok(res, summary(settled))
  }
  if (outcome === 'mismatch') {
    logger.warn(`payment ${payment.id}: amount mismatch from ${payment.gateway}`, { raw })
    await failPayment(payment.id, raw)
    throw new ApiError(400, 'PAYMENT_MISMATCH', 'The paid amount does not match the plan price')
  }
  if (outcome === 'failed') {
    await failPayment(payment.id, raw)
    return ok(res, { ...summary(payment), status: 'FAILED' })
  }
  return ok(res, { ...summary(payment), status: 'PENDING' })
}

// ---------- Khalti ----------

export async function khaltiInitiate(req, res) {
  requireKhalti()
  const { listing, plan } = await purchaseTarget(req)
  const { payment } = await createPendingPurchase({
    businessId: listing.id,
    plan,
    gateway: 'KHALTI',
  })
  try {
    const { pidx, paymentUrl } = await initiateKhalti({
      paymentId: payment.id,
      amountNpr: plan.priceNpr,
      planName: `${plan.name} for ${listing.name}`.slice(0, 100),
      customer: req.user,
    })
    await db.payment.update({ where: { id: payment.id }, data: { gatewayRef: pidx } })
    return created(res, { paymentUrl, pidx })
  } catch (err) {
    await failPayment(payment.id, { error: err.message })
    throw err
  }
}

export async function khaltiVerify(req, res) {
  const payment = await ownPayment(req, 'KHALTI', req.body.pidx)
  // A repeated callback returns the existing result (gatewayRef is unique).
  if (payment.status !== 'INITIATED') return ok(res, summary(payment))
  return settle(
    req,
    res,
    payment,
    await lookupKhalti({ pidx: payment.gatewayRef, amountNpr: payment.amountNpr }),
  )
}

// ---------- eSewa ----------

export async function esewaInitiate(req, res) {
  requireEsewa()
  const { listing, plan } = await purchaseTarget(req)
  const { payment } = await createPendingPurchase({
    businessId: listing.id,
    plan,
    gateway: 'ESEWA',
  })
  // transaction_uuid: alphanumeric and hyphens; the payment id is unique per attempt.
  await db.payment.update({ where: { id: payment.id }, data: { gatewayRef: payment.id } })
  return created(res, esewaForm({ transactionUuid: payment.id, amountNpr: plan.priceNpr }))
}

export async function esewaVerify(req, res) {
  const fields = decodeEsewaResponse(req.body.data)
  const payment = await ownPayment(req, 'ESEWA', fields.transaction_uuid)
  if (payment.status !== 'INITIATED') return ok(res, summary(payment))
  if (esewaAmount(fields.total_amount) !== payment.amountNpr) {
    return settle(req, res, payment, { outcome: 'mismatch', raw: fields })
  }
  // The redirect alone is not proof: confirm with eSewa's status check.
  const check = await checkEsewa({
    transactionUuid: payment.gatewayRef,
    amountNpr: payment.amountNpr,
  })
  return settle(req, res, payment, { ...check, raw: { redirect: fields, status: check.raw } })
}
