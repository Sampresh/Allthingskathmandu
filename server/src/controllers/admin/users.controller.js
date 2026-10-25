import { db, readDb } from '../../config/db.js'
import { idPage } from '../../lib/cursor.js'
import { isStaff } from '../../middleware/requireRole.js'
import { audit } from '../../services/audit.js'
import { revokeAllSessions } from '../../services/token.js'
import { ApiError } from '../../utils/ApiError.js'
import { ok } from '../../utils/ApiResponse.js'

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000

const userFields = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  emailVerifiedAt: true,
  totpEnabled: true,
  lastLoginAt: true,
  createdAt: true,
  _count: { select: { businesses: true } },
}

export async function listUsers(req, res) {
  const { q, role, status, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.user.findMany({
    where: {
      deletedAt: null,
      ...page.where,
      ...(role && { role }),
      ...(status && { status }),
      ...(q && {
        OR: [
          { email: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      }),
    },
    orderBy: page.orderBy,
    take: page.take,
    select: userFields,
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

async function targetUser(req) {
  const user = await db.user.findFirst({ where: { id: req.params.id, deletedAt: null } })
  if (!user) throw ApiError.notFound('User not found')
  if (user.id === req.user.id) throw ApiError.forbidden('You cannot change your own account here')
  return user
}

/** Suspend or reactivate. Staff accounts can only be changed by a super admin. */
export async function setUserStatus(req, res) {
  const user = await targetUser(req)
  if (isStaff(user.role) && req.user.role !== 'SUPER_ADMIN') {
    throw ApiError.forbidden('Only a super admin can change staff accounts')
  }
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { status: req.body.status } })
    await audit(tx, req, {
      action: 'user.status',
      entity: 'user',
      entityId: user.id,
      diff: { status: { from: user.status, to: req.body.status } },
    })
  })
  if (req.body.status === 'SUSPENDED') await revokeAllSessions(user.id)
  return ok(res, { id: user.id, status: req.body.status })
}

/** Super admin only. Signs the user out everywhere so the new role applies at once. */
export async function setUserRole(req, res) {
  const user = await targetUser(req)
  // The acting super admin cannot change their own role, so one always remains.
  const { role } = req.body
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { role } })
    await audit(tx, req, {
      action: 'user.role',
      entity: 'user',
      entityId: user.id,
      diff: { role: { from: user.role, to: role } },
    })
  })
  await revokeAllSessions(user.id)
  return ok(res, { id: user.id, role })
}

export async function listAudit(req, res) {
  const { entity, entityId, actorId, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.auditLog.findMany({
    where: {
      ...page.where,
      ...(entity && { entity }),
      ...(entityId && { entityId }),
      ...(actorId && { actorId }),
    },
    orderBy: page.orderBy,
    take: page.take,
    include: { actor: { select: { id: true, name: true, email: true } } },
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

/** Counts, pending queues and revenue this month (Nepal Time). */
export async function overview(req, res) {
  const local = new Date(Date.now() + NEPAL_OFFSET_MS)
  const monthStart = new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - NEPAL_OFFSET_MS,
  )

  const [listings, users, claims, reviews, reports, events, market, revenue] = await Promise.all([
    readDb.business.groupBy({ by: ['status'], where: { deletedAt: null }, _count: true }),
    readDb.user.count({ where: { deletedAt: null } }),
    readDb.claim.count({ where: { status: 'PENDING' } }),
    readDb.review.count({ where: { status: 'PENDING' } }),
    readDb.report.count({ where: { status: 'OPEN' } }),
    readDb.event.count({ where: { status: 'PENDING' } }),
    readDb.marketItem.count({ where: { status: 'PENDING', deletedAt: null } }),
    readDb.payment.aggregate({
      where: { status: 'COMPLETED', verifiedAt: { gte: monthStart } },
      _sum: { amountNpr: true },
    }),
  ])
  return ok(res, {
    listings: Object.fromEntries(listings.map((l) => [l.status, l._count])),
    users,
    pending: { claims, reviews, reports, events, market },
    revenueThisMonthNpr: revenue._sum.amountNpr ?? 0,
  })
}
