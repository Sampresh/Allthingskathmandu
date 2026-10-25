import { db, readDb } from '../config/db.js'

// Only content visitors can actually see can be reported.
const PUBLIC_ENTITY = {
  BUSINESS: (id) => readDb.business.count({ where: { id, status: 'LIVE', deletedAt: null } }),
  REVIEW: (id) => readDb.review.count({ where: { id, status: 'APPROVED' } }),
  MARKET_ITEM: (id) => readDb.marketItem.count({ where: { id, status: 'LIVE', deletedAt: null } }),
  EVENT: (id) => readDb.event.count({ where: { id, status: 'APPROVED' } }),
}

export async function isReportable(entityType, entityId) {
  return (await PUBLIC_ENTITY[entityType](entityId)) > 0
}

export function createReport({ entityType, entityId, reason, details, userId }) {
  return db.report.create({
    data: { entityType, entityId, reason, details: details || null, userId: userId ?? null },
  })
}
