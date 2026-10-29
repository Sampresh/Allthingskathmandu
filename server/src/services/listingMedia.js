import { db } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'
import { audit } from './audit.js'
import { confirmUpload, isVideoUrl, queueMediaDelete } from './media.js'

// Gallery and video for a listing (Featured only). Owners and Admin share these; each passes
// the photo and video limits that apply to it.

const FALLBACK_LIMITS = { maxPhotos: 12, maxVideos: 3 }

/** Limits when Admin edits a listing: Featured (featuredUntil) and the Featured plan's caps. */
export async function adminMediaLimits(listing) {
  if (!listing.featuredUntil || listing.featuredUntil <= new Date()) {
    throw ApiError.forbidden(
      'Photos and videos are for Featured listings; set Featured until first',
      'FEATURED_REQUIRED',
    )
  }
  const plan = await db.plan.findUnique({ where: { code: 'FEATURED' } })
  return { ...FALLBACK_LIMITS, ...plan?.features }
}

async function assertRoom(businessId, type, limits) {
  const count = await db.media.count({ where: { businessId, type } })
  const max = type === 'PHOTO' ? limits.maxPhotos : limits.maxVideos
  if (count >= max) {
    throw ApiError.forbidden(
      `The plan allows ${max} ${type === 'PHOTO' ? 'photos' : 'videos'}`,
      'PLAN_LIMIT',
    )
  }
}

export const assertPhotoRoom = (businessId, limits) => assertRoom(businessId, 'PHOTO', limits)

/** Adds a confirmed photo upload or a YouTube/Reels link at the end of the gallery. */
export async function addMedia(req, businessId, { type, altText, publicId, url }, limits) {
  await assertRoom(businessId, type, limits)
  let source
  if (type === 'PHOTO') {
    const upload = await confirmUpload({
      publicId,
      scope: 'listings',
      id: businessId,
      kind: 'photo',
    })
    source = { url: upload.url, publicId: upload.publicId }
  } else {
    if (!isVideoUrl(url)) throw ApiError.badRequest('Use a YouTube or Instagram Reels link')
    source = { url, publicId: null }
  }
  const last = await db.media.findFirst({ where: { businessId }, orderBy: { sortOrder: 'desc' } })
  return db.$transaction(async (tx) => {
    const row = await tx.media.create({
      data: { businessId, type, altText, ...source, sortOrder: (last?.sortOrder ?? -1) + 1 },
    })
    await audit(tx, req, {
      action: 'media.create',
      entity: 'media',
      entityId: row.id,
      diff: { businessId, type, url: row.url },
    })
    return row
  })
}

/** Puts the gallery in the order of `ids` (every id must belong to the listing). */
export async function reorderMedia(req, businessId, ids) {
  const owned = await db.media.count({ where: { businessId, id: { in: ids } } })
  if (owned !== new Set(ids).size) throw ApiError.badRequest('Unknown photo or video in the list')
  await db.$transaction(async (tx) => {
    for (const [sortOrder, id] of ids.entries())
      await tx.media.update({ where: { id }, data: { sortOrder } })
    await audit(tx, req, {
      action: 'media.reorder',
      entity: 'business',
      entityId: businessId,
      diff: { ids },
    })
  })
  return { reordered: ids.length }
}

/** Removes one photo or video; the Cloudinary file is deleted by the worker. */
export async function deleteMedia(req, businessId, mediaId) {
  const media = await db.media.findFirst({ where: { id: mediaId, businessId } })
  if (!media) throw ApiError.notFound('Photo or video not found')
  await db.$transaction(async (tx) => {
    await tx.media.delete({ where: { id: media.id } })
    await audit(tx, req, {
      action: 'media.delete',
      entity: 'media',
      entityId: media.id,
      diff: { businessId, url: media.url },
    })
  })
  await queueMediaDelete(media.publicId)
  return { deleted: true }
}

/** Updates the alt text (required for every photo). */
export async function updateMediaAlt(req, businessId, mediaId, altText) {
  const media = await db.media.findFirst({ where: { id: mediaId, businessId } })
  if (!media) throw ApiError.notFound('Photo or video not found')
  return db.$transaction(async (tx) => {
    const row = await tx.media.update({ where: { id: media.id }, data: { altText } })
    await audit(tx, req, {
      action: 'media.update',
      entity: 'media',
      entityId: media.id,
      diff: { altText: { from: media.altText, to: altText } },
    })
    return row
  })
}
