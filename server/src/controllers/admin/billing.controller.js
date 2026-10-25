import { db, readDb } from '../../config/db.js'
import { idPage } from '../../lib/cursor.js'
import { audit, changedFields } from '../../services/audit.js'
import { queueContentChange } from '../../services/revalidate.js'
import { ApiError } from '../../utils/ApiError.js'
import { created, ok } from '../../utils/ApiResponse.js'

// A paid plan (Featured placement) can only go live once Admin has set its price.
function assertSellable(plan) {
  if (plan.isActive && plan.features.featured && plan.priceNpr <= 0) {
    throw ApiError.badRequest('Set a price before activating a Featured plan')
  }
}

export async function listPlans(req, res) {
  return ok(res, await readDb.plan.findMany({ orderBy: { sortOrder: 'asc' } }))
}

export async function createPlan(req, res) {
  if (await db.plan.findUnique({ where: { code: req.body.code } }))
    throw ApiError.conflict('That plan code exists')
  assertSellable({ isActive: true, ...req.body })
  const plan = await db.$transaction(async (tx) => {
    const row = await tx.plan.create({ data: req.body })
    await audit(tx, req, {
      action: 'plan.create',
      entity: 'plan',
      entityId: row.id,
      diff: req.body,
    })
    return row
  })
  await queueContentChange({ cacheTags: ['plans'] })
  return created(res, plan)
}

export async function updatePlan(req, res) {
  const before = await db.plan.findUnique({ where: { id: req.params.id } })
  if (!before) throw ApiError.notFound('Plan not found')
  assertSellable({ ...before, ...req.body })
  const plan = await db.$transaction(async (tx) => {
    const row = await tx.plan.update({ where: { id: before.id }, data: req.body })
    await audit(tx, req, {
      action: 'plan.update',
      entity: 'plan',
      entityId: row.id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  await queueContentChange({ cacheTags: ['plans'] })
  return ok(res, plan)
}

export async function listPayments(req, res) {
  const { status, gateway, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.payment.findMany({
    where: { ...page.where, ...(status && { status }), ...(gateway && { gateway }) },
    orderBy: page.orderBy,
    take: page.take,
    select: {
      id: true,
      gateway: true,
      gatewayRef: true,
      invoiceNo: true,
      amountNpr: true,
      status: true,
      verifiedAt: true,
      createdAt: true,
      business: { select: { id: true, name: true, slug: true } },
      subscription: {
        select: { id: true, status: true, plan: { select: { code: true, name: true } } },
      },
    },
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

export async function getPayment(req, res) {
  const payment = await readDb.payment.findUnique({
    where: { id: req.params.id },
    include: {
      business: {
        select: {
          id: true,
          name: true,
          slug: true,
          owner: { select: { id: true, name: true, email: true } },
        },
      },
      subscription: { include: { plan: true } },
    },
  })
  if (!payment) throw ApiError.notFound('Payment not found')
  return ok(res, payment)
}
