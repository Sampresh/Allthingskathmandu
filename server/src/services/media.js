import { randomBytes } from 'node:crypto'
import { cloudinary, cloudinaryConfigured } from '../config/cloudinary.js'
import { env } from '../config/env.js'
import { QUEUE, enqueue } from '../jobs/queues.js'
import { ApiError } from '../utils/ApiError.js'

const MB = 1024 * 1024
const LOOKUP_TIMEOUT_MS = 10_000

// What each kind of upload may be (Part 8 §5: jpg, png, webp; size caps).
export const UPLOAD_KINDS = {
  logo: { formats: ['jpg', 'png', 'webp'], maxBytes: 2 * MB },
  photo: { formats: ['jpg', 'png', 'webp'], maxBytes: 5 * MB },
  proof: { formats: ['jpg', 'png', 'webp'], maxBytes: 5 * MB },
  cover: { formats: ['jpg', 'png', 'webp'], maxBytes: 5 * MB },
}

function requireCloudinary() {
  if (!cloudinaryConfigured) throw ApiError.unavailable('Uploads are not set up')
}

/** Folder prefix every upload of this owner/listing must sit under. */
export const uploadPrefix = (scope, id) => `${env.CLOUDINARY_FOLDER}/${scope}/${id}/`

/**
 * Signed params for one direct browser upload (files never pass through the API). The API
 * picks the public_id, so the saved file can be checked against this listing or user.
 */
export function signUpload({ scope, id, kind }) {
  requireCloudinary()
  const { formats, maxBytes } = UPLOAD_KINDS[kind]
  const params = {
    timestamp: Math.floor(Date.now() / 1000),
    public_id: `${uploadPrefix(scope, id)}${kind}-${randomBytes(8).toString('hex')}`,
    allowed_formats: formats.join(','),
  }
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    ...params,
    signature: cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET),
    maxBytes,
  }
}

/**
 * Looks the uploaded file up on Cloudinary (not trusting what the browser reports) and
 * checks where it lives, its format and its size. Returns { url, publicId, bytes, width, height }.
 */
export async function confirmUpload({ publicId, scope, id, kind }) {
  requireCloudinary()
  const { formats, maxBytes } = UPLOAD_KINDS[kind]
  if (!publicId.startsWith(`${uploadPrefix(scope, id)}${kind}-`)) {
    throw ApiError.badRequest('That upload does not belong here')
  }

  let resource
  try {
    resource = await Promise.race([
      cloudinary.api.resource(publicId),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), LOOKUP_TIMEOUT_MS)),
    ])
  } catch (err) {
    if (err?.error?.http_code === 404)
      throw ApiError.badRequest('Upload not found; please try again')
    throw ApiError.unavailable('Could not check the upload; please try again')
  }

  if (!formats.includes(resource.format) || resource.bytes > maxBytes) {
    await queueMediaDelete(publicId)
    throw ApiError.badRequest(
      `Use a ${formats.join(', ')} image up to ${Math.round(maxBytes / MB)} MB`,
    )
  }
  return {
    url: resource.secure_url,
    publicId: resource.public_id,
    bytes: resource.bytes,
    width: resource.width,
    height: resource.height,
  }
}

/** Deletes a Cloudinary asset in the worker. */
/** Cloudinary public_id of one of our delivery URLs (…/image/upload/v123/<public_id>.<ext>). */
export function publicIdFromUrl(url) {
  const match = /\/image\/upload\/(?:v\d+\/)?(.+)\.\w+$/.exec(url ?? '')
  return match?.[1] ?? null
}

export function queueMediaDelete(publicId) {
  return publicId ? enqueue(QUEUE.MEDIA, 'delete', { publicId }) : null
}

export async function destroyAsset(publicId) {
  if (!cloudinaryConfigured) return { skipped: true }
  return cloudinary.uploader.destroy(publicId, { invalidate: true })
}

// YouTube (watch, youtu.be, shorts) and Instagram Reels links for listing videos.
const VIDEO_URL =
  /^https:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?v=|shorts\/)[\w-]{6,}|youtu\.be\/[\w-]{6,}|(?:www\.)?instagram\.com\/(?:reel|reels|p)\/[\w-]+)/
export const isVideoUrl = (url) => VIDEO_URL.test(url)
