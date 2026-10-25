import { db, readDb } from '../../config/db.js'
import { QUEUE, getQueue, enqueue } from '../../jobs/queues.js'
import { idPage } from '../../lib/cursor.js'
import { audit, changedFields } from '../../services/audit.js'
import {
  afterListingChange,
  createListing,
  listingSlugTaken,
  updateListing,
} from '../../services/listings.js'
import { ApiError } from '../../utils/ApiError.js'
import { created, ok } from '../../utils/ApiResponse.js'

const tableSelect = {
  id: true,
  slug: true,
  name: true,
  type: true,
  status: true,
  isVerified: true,
  featuredUntil: true,
  updatedAt: true,
  area: { select: { nameEn: true } },
  owner: { select: { id: true, name: true, email: true } },
  categories: {
    where: { isPrimary: true },
    select: { category: { select: { id: true, nameEn: true } } },
  },
}

export async function list(req, res) {
  const { q, status, category, area, cursor, limit } = req.query
  const page = idPage(cursor, limit)
  const rows = await readDb.business.findMany({
    where: {
      deletedAt: null,
      ...page.where,
      ...(status && { status }),
      ...(area && { areaId: area }),
      ...(category && { categories: { some: { categoryId: category } } }),
      ...(q && {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { slug: { contains: q.toLowerCase() } },
        ],
      }),
    },
    orderBy: page.orderBy,
    take: page.take,
    select: tableSelect,
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(
    res,
    items.map(({ categories, ...l }) => ({ ...l, category: categories[0]?.category ?? null })),
    { nextCursor },
  )
}

async function loadDetail(id) {
  const listing = await db.business.findFirst({
    where: { id, deletedAt: null },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      categories: { orderBy: { isPrimary: 'desc' }, include: { category: true } },
      tags: { include: { tag: true } },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 3, include: { plan: true } },
    },
  })
  if (!listing) throw ApiError.notFound('Listing not found')
  const [location] = await db.$queryRaw`
    SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM businesses WHERE id = ${id}::uuid AND location IS NOT NULL`
  return {
    ...listing,
    location: location ?? null,
    categoryIds: listing.categories.map((c) => c.categoryId),
    tagIds: listing.tags.map((t) => t.tagId),
  }
}

export async function detail(req, res) {
  return ok(res, await loadDetail(req.params.id))
}

export async function create(req, res) {
  const body = req.body
  if (body.slug && (await listingSlugTaken(db)(body.slug)))
    throw ApiError.conflict('That slug is taken')
  const listing = await db.$transaction(async (tx) => {
    const row = await createListing(tx, body)
    await audit(tx, req, {
      action: 'business.create',
      entity: 'business',
      entityId: row.id,
      diff: { name: row.name, status: row.status },
    })
    return row
  })
  await afterListingChange(listing, body.categoryIds)
  return created(res, await loadDetail(listing.id))
}

export async function update(req, res) {
  const { id } = req.params
  const before = await loadDetail(id)
  if (req.body.slug && (await listingSlugTaken(db, id)(req.body.slug)))
    throw ApiError.conflict('That slug is taken')

  const listing = await db.$transaction(async (tx) => {
    const row = await updateListing(tx, id, req.body)
    await audit(tx, req, {
      action: 'business.update',
      entity: 'business',
      entityId: id,
      diff: changedFields(before, req.body),
    })
    return row
  })
  await afterListingChange({ ...listing, oldSlug: before.slug }, [
    ...new Set([...before.categoryIds, ...(req.body.categoryIds ?? [])]),
  ])
  return ok(res, await loadDetail(id))
}

export async function remove(req, res) {
  const before = await loadDetail(req.params.id)
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: before.id }, data: { deletedAt: new Date() } })
    await audit(tx, req, { action: 'business.delete', entity: 'business', entityId: before.id })
  })
  await afterListingChange(before, before.categoryIds)
  return ok(res, { deleted: true })
}

export async function setStatus(req, res) {
  const before = await loadDetail(req.params.id)
  const listing = await db.$transaction(async (tx) => {
    const row = await tx.business.update({
      where: { id: before.id },
      data: { status: req.body.status },
    })
    // A member's "List your business" submission going live makes them a business owner.
    if (row.status === 'LIVE' && row.ownerId) {
      await tx.user.updateMany({
        where: { id: row.ownerId, role: 'MEMBER' },
        data: { role: 'BUSINESS_OWNER' },
      })
    }
    await audit(tx, req, {
      action: 'business.status',
      entity: 'business',
      entityId: before.id,
      diff: changedFields(before, { status: req.body.status }),
    })
    return row
  })
  await afterListingChange(listing, before.categoryIds)
  return ok(res, { id: listing.id, status: listing.status })
}

/** Gives a listing to a user; a member becomes a business owner. */
export async function assignOwner(req, res) {
  const before = await loadDetail(req.params.id)
  const user = await db.user.findFirst({
    where: {
      deletedAt: null,
      ...(req.body.userId ? { id: req.body.userId } : { email: req.body.email.toLowerCase() }),
    },
  })
  if (!user) throw ApiError.notFound('User not found')
  if (!['MEMBER', 'BUSINESS_OWNER'].includes(user.role)) {
    throw ApiError.badRequest('Only members and business owners can own listings')
  }

  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: before.id }, data: { ownerId: user.id } })
    if (user.role === 'MEMBER')
      await tx.user.update({ where: { id: user.id }, data: { role: 'BUSINESS_OWNER' } })
    await audit(tx, req, {
      action: 'business.assign_owner',
      entity: 'business',
      entityId: before.id,
      diff: { ownerId: { from: before.ownerId, to: user.id } },
    })
  })
  return ok(res, await loadDetail(before.id))
}

/** Queues a CSV import (parsed and written by the worker). */
export async function importCsv(req, res) {
  // One attempt only: a retry after partial progress would create duplicates.
  const job = await enqueue(
    QUEUE.IMPORT,
    'listings',
    { csv: req.body.csv, actorId: req.user.id, ip: req.ip },
    { attempts: 1 },
  )
  return created(res, { jobId: job.id })
}

export async function importStatus(req, res) {
  const job = await getQueue(QUEUE.IMPORT).getJob(req.params.jobId)
  if (!job) throw ApiError.notFound('Import not found')
  return ok(res, {
    jobId: job.id,
    state: await job.getState(),
    result: job.returnvalue ?? null,
    error: job.failedReason ?? null,
  })
}
