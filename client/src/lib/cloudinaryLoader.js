const CLOUDINARY = 'https://res.cloudinary.com/'
const MARKER = '/image/upload/'

// Demo/stock photos (seeded listings) come straight from Unsplash's CDN, which resizes with
// its own query params. Production content is still Cloudinary; this only widens what renders.
const UNSPLASH = 'https://images.unsplash.com/'

/** Cloudinary-hosted images (own uploads: logos, Featured photos, market media). */
export const isCloudinaryUrl = (src) =>
  typeof src === 'string' && src.startsWith(CLOUDINARY) && src.includes(MARKER)

export const isUnsplashUrl = (src) => typeof src === 'string' && src.startsWith(UNSPLASH)

/** Any image host the client is allowed to render (Cloudinary + Unsplash stock). */
export const isAllowedImageUrl = (src) => isCloudinaryUrl(src) || isUnsplashUrl(src)

// Cloudinary does the resizing: f_auto (format), q_auto (quality), width per breakpoint.
// Unsplash resizes with auto=format&w=&q=&fit=crop. Also the next/image loader (loaderFile).
export default function cloudinaryLoader({ src, width, quality }) {
  if (isCloudinaryUrl(src)) {
    const [base, rest] = src.split(MARKER)
    return `${base}${MARKER}f_auto,q_${quality ?? 'auto'},c_limit,w_${width}/${rest}`
  }
  if (isUnsplashUrl(src)) {
    const sep = src.includes('?') ? '&' : '?'
    return `${src}${sep}auto=format&fit=crop&w=${width}&q=${quality ?? 70}`
  }
  return src
}
