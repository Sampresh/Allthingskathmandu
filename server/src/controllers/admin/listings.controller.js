import { db } from '../../config/db.js'
import { QUEUE, getQueue, enqueue } from '../../jobs/queues.js'
import { idPage } from '../../lib/cursor.js'
import { toCsv } from '../../lib/csv.js'
import {
  EXPORT_COLUMNS,
  exportAdminListings,
  listAdminListings,
} from '../../services/adminListings.js'
import { audit, changedFields } from '../../services/audit.js'
import {
  bulkAction,
  changeStatus,
  deletePermanently,
  duplicateListing,
  promoteOwner,
} from '../../services/listingAdmin.js'
import { parseListingsCsv, planImport, resultCsv } from '../../services/listingImport.js'
import * as media from '../../services/listingMedia.js'
import { assertPublishable, ruleInputs } from '../../services/listingRules.js'
import {
  afterListingChange,
  createListing,
  listingSlugTaken,
  updateListing,
} from '../../services/listings.js'
import { confirmUpload, queueMediaDelete, signUpload } from '../../services/media.js'
import { ApiError } from '../../utils/ApiError.js'
import { created, ok } from '../../utils/ApiResponse.js'
import { phoneProblem, publishProblems } from '../../validators/listing.schema.js'

// ---------- Table and export ----------

export async function list(req, res) {
  const { items, nextCursor, counts } = await listAdminListings(req.query)
  return ok(res, items, { nextCursor, counts })
}

/** CSV of every listing matching the table's filters (no Google fields). */
export async function exportCsv(req, res) {
  const rows = await exportAdminListings(req.query)
  const stamp = new Date().toISOString().slice(0, 10)
  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="listings-${stamp}.csv"`)
  return res.send(toCsv(rows, EXPORT_COLUMNS))
}

// ---------- One listing ----------

/** Full listing for the edit form, Trash included. */
async function loadDetail(id, { allowDeleted = true } = {}) {
  const listing = await db.business.findFirst({
    where: { id, ...(!allowDeleted && { deletedAt: null }) },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      area: { select: { id: true, slug: true, nameEn: true } },
      categories: {
        orderBy: { isPrimary: 'desc' },
        include: { category: { include: { parent: { select: { slug: true, nameEn: true } } } } },
      },
      tags: { include: { tag: true } },
      media: { orderBy: { sortOrder: 'asc' } },
      claims: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      subscriptions: { orderBy: { createdAt: 'desc' }, take: 3, include: { plan: true } },
    },
  })
  if (!listing) throw ApiError.notFound('Listing not found')
  const [location] = await db.$queryRaw`
    SELECT ST_Y(location::geometry) AS lat, ST_X(location::geometry) AS lng
    FROM businesses WHERE id = ${id}::uuid AND location IS NOT NULL`
  const rules = (await ruleInputs(db, [id])).get(id)
  return {
    ...listing,
    location: location ?? null,
    categoryIds: listing.categories.map((c) => c.categoryId),
    tagIds: listing.tags.map((t) => t.tagId),
    publishProblems: publishProblems(rules),
  }
}

/** The listing must exist and not be in Trash to be edited. */
async function editable(id) {
  const listing = await loadDetail(id)
  if (listing.deletedAt) throw ApiError.conflict('This listing is in Trash; restore it first')
  return listing
}

export async function detail(req, res) {
  return ok(res, await loadDetail(req.params.id))
}

function assertPhoneFits(type, phone) {
  const message = phoneProblem(type, phone)
  if (message) throw ApiError.validation([{ path: 'phone', message }])
}

export async function create(req, res) {
  const body = req.body
  if (body.slug && (await listingSlugTaken(db)(body.slug)))
    throw ApiError.conflict('That slug is taken')
  if (
    body.googlePlaceId &&
    (await db.business.findUnique({ where: { googlePlaceId: body.googlePlaceId } }))
  )
    throw ApiError.conflict('Another listing already has that Google place id')
  const listing = await db.$transaction(async (tx) => {
    const row = await createListing(tx, { status: 'DRAFT', ...body })
    if (row.status === 'LIVE') await assertPublishable(tx, row.id)
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
  const before = await editable(id)
  const body = req.body
  if (body.slug && (await listingSlugTaken(db, id)(body.slug)))
    throw ApiError.conflict('That slug is taken')
  if (
    body.googlePlaceId &&
    (await db.business.findFirst({ where: { googlePlaceId: body.googlePlaceId, id: { not: id } } }))
  )
    throw ApiError.conflict('Another listing already has that Google place id')
  assertPhoneFits(body.type ?? before.type, body.phone !== undefined ? body.phone : before.phone)

  const listing = await db.$transaction(async (tx) => {
    const row = await updateListing(tx, id, body)
    // A LIVE listing must still pass the publish rules after the edit.
    if (row.status === 'LIVE') await assertPublishable(tx, id)
    if (row.status !== before.status) await promoteOwner(tx, row)
    await audit(tx, req, {
      action: 'business.update',
      entity: 'business',
      entityId: id,
      diff: changedFields(before, body),
    })
    return row
  })
  await afterListingChange({ ...listing, oldSlug: before.slug }, [
    ...new Set([...before.categoryIds, ...(body.categoryIds ?? [])]),
  ])
  return ok(res, await loadDetail(id))
}

export async function setStatus(req, res) {
  const before = await editable(req.params.id)
  const listing = await db.$transaction((tx) => changeStatus(tx, req, before, req.body.status))
  await afterListingChange(listing, before.categoryIds)
  return ok(res, { id: listing.id, status: listing.status })
}

export async function duplicate(req, res) {
  const copy = await db.$transaction((tx) => duplicateListing(tx, req, req.params.id))
  return created(res, await loadDetail(copy.id))
}

/** Soft delete: the listing goes to Trash and off the public site. */
export async function remove(req, res) {
  const before = await editable(req.params.id)
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: before.id }, data: { deletedAt: new Date() } })
    await audit(tx, req, { action: 'business.delete', entity: 'business', entityId: before.id })
  })
  await afterListingChange(before, before.categoryIds)
  return ok(res, { deleted: true })
}

export async function restore(req, res) {
  const before = await loadDetail(req.params.id)
  if (!before.deletedAt) throw ApiError.conflict('This listing is not in Trash')
  await db.$transaction(async (tx) => {
    await tx.business.update({ where: { id: before.id }, data: { deletedAt: null } })
    await audit(tx, req, { action: 'business.restore', entity: 'business', entityId: before.id })
  })
  await afterListingChange(before, before.categoryIds)
  return ok(res, await loadDetail(before.id))
}

/** SUPER_ADMIN: delete from Trash for good; Cloudinary files are removed by the worker. */
export async function removePermanently(req, res) {
  return ok(res, await deletePermanently(req, req.params.id, req.body.confirmName))
}

export async function bulk(req, res) {
  return ok(res, await bulkAction(req, req.body))
}

/** Audit log entries for this listing, newest first. */
export async function history(req, res) {
  const page = idPage(req.query.cursor, req.query.limit)
  const mediaIds = (
    await db.media.findMany({ where: { businessId: req.params.id }, select: { id: true } })
  ).map((m) => m.id)
  const rows = await db.auditLog.findMany({
    where: {
      ...page.where,
      OR: [
        { entity: 'business', entityId: req.params.id },
        { entity: 'media', entityId: { in: mediaIds } },
        { entity: 'business', diff: { path: ['from'], equals: req.params.id } },
      ],
    },
    orderBy: page.orderBy,
    take: page.take,
    include: { actor: { select: { id: true, name: true, email: true } } },
  })
  const { items, nextCursor } = page.finish(rows)
  return ok(res, items, { nextCursor })
}

// ---------- Logo and gallery ----------

export async function signLogo(req, res) {
  await editable(req.params.id)
  return ok(res, signUpload({ scope: 'listings', id: req.params.id, kind: 'logo' }))
}

/** Sets the logo from a signed upload (checked on Cloudinary), or removes it with null. */
export async function setLogo(req, res) {
  const before = await editable(req.params.id)
  const { publicId } = req.body
  const upload = publicId
    ? await confirmUpload({ publicId, scope: 'listings', id: before.id, kind: 'logo' })
    : null
  const data = { logoUrl: upload?.url ?? null, logoPublicId: upload?.publicId ?? null }
  await db.$transaction(async (tx) => {
    await updateListing(tx, before.id, data)
    if (before.status === 'LIVE') await assertPublishable(tx, before.id)
    await audit(tx, req, {
      action: 'business.logo',
      entity: 'business',
      entityId: before.id,
      diff: changedFields(before, data),
    })
  })
  if (before.logoPublicId && before.logoPublicId !== data.logoPublicId)
    await queueMediaDelete(before.logoPublicId)
  await afterListingChange(before, before.categoryIds)
  return ok(res, await loadDetail(before.id))
}

export async function signMedia(req, res) {
  const listing = await editable(req.params.id)
  await media.assertPhotoRoom(listing.id, await media.adminMediaLimits(listing))
  return ok(res, signUpload({ scope: 'listings', id: listing.id, kind: 'photo' }))
}

export async function addMedia(req, res) {
  const listing = await editable(req.params.id)
  const row = await media.addMedia(req, listing.id, req.body, await media.adminMediaLimits(listing))
  await afterListingChange(listing, listing.categoryIds)
  return created(res, row)
}

export async function reorderMedia(req, res) {
  const listing = await editable(req.params.id)
  const result = await media.reorderMedia(req, listing.id, req.body.ids)
  await afterListingChange(listing, listing.categoryIds)
  return ok(res, result)
}

export async function updateMedia(req, res) {
  const listing = await editable(req.params.id)
  const row = await media.updateMediaAlt(req, listing.id, req.params.mediaId, req.body.altText)
  await afterListingChange(listing, listing.categoryIds)
  return ok(res, row)
}

export async function deleteMedia(req, res) {
  const listing = await editable(req.params.id)
  const result = await media.deleteMedia(req, listing.id, req.params.mediaId)
  await afterListingChange(listing, listing.categoryIds)
  return ok(res, result)
}

// ---------- Owner ----------

/** Gives a listing to a user; a member becomes a business owner. */
export async function assignOwner(req, res) {
  const before = await editable(req.params.id)
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

/**
 * CSV import (docs/LISTINGS.md format). A dry run answers at once with counts and a row
 * report; a real run is queued for the worker.
 */
export async function importCsv(req, res) {
  const { csv, dryRun } = req.body
  if (dryRun) {
    const { counts, rows } = await planImport(csv)
    return ok(res, { dryRun: true, counts, rows })
  }
  parseListingsCsv(csv) // a malformed file is a 400 now, not a failed job later
  // One attempt only: a retry after partial progress would only repeat finished rows.
  const job = await enqueue(
    QUEUE.IMPORT,
    'listings',
    { csv, actorId: req.user.id, ip: req.ip },
    { attempts: 1 },
  )
  return created(res, { jobId: job.id })
}

async function importJob(jobId) {
  const job = await getQueue(QUEUE.IMPORT).getJob(jobId)
  if (!job) throw ApiError.notFound('Import not found')
  return job
}

export async function importStatus(req, res) {
  const job = await importJob(req.params.jobId)
  const state = await job.getState()
  return ok(res, {
    jobId: job.id,
    state,
    progress: typeof job.progress === 'object' ? job.progress : null,
    counts: job.returnvalue?.counts ?? null,
    rows: state === 'completed' ? job.returnvalue.rows : null,
    error: job.failedReason ?? null,
  })
}

/** Row-level result of a finished import, as CSV. */
export async function importResult(req, res) {
  const job = await importJob(req.params.jobId)
  if (!job.returnvalue?.rows) throw ApiError.conflict('This import has not finished')
  res.set('Content-Type', 'text/csv; charset=utf-8')
  res.set('Content-Disposition', `attachment; filename="import-${job.id}.csv"`)
  return res.send(resultCsv(job.returnvalue.rows))
}
