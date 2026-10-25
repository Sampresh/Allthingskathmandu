const CLOUDINARY = 'https://res.cloudinary.com/'
const MARKER = '/image/upload/'

/** Images are served only from Cloudinary (same rule as images.remotePatterns). */
export const isCloudinaryUrl = (src) =>
  typeof src === 'string' && src.startsWith(CLOUDINARY) && src.includes(MARKER)

// Cloudinary does the resizing: f_auto (format), q_auto (quality), width per breakpoint.
// Also the next/image loader (next.config.mjs loaderFile).
export default function cloudinaryLoader({ src, width, quality }) {
  if (!isCloudinaryUrl(src)) return src
  const [base, rest] = src.split(MARKER)
  return `${base}${MARKER}f_auto,q_${quality ?? 'auto'},c_limit,w_${width}/${rest}`
}
