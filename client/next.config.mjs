const origin = (url) => {
  try {
    return url ? new URL(url).origin : null
  } catch {
    return null
  }
}
// The Sentry DSN's host is where browser errors are sent (https://key@o1.ingest.sentry.io/2).
const sentryOrigin = origin(process.env.NEXT_PUBLIC_SENTRY_DSN?.replace(/\/\/[^@/]+@/, '//'))

const GOOGLE_MAPS = [
  'https://*.googleapis.com',
  'https://*.gstatic.com',
  '*.google.com',
  'https://*.ggpht.com',
  '*.googleusercontent.com',
]

// Allowlist CSP (Part 2 security defaults; pages are static/ISR, so no per-request nonces).
// Maps hosts follow Google's published list for the Maps JavaScript API.
const csp = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'blob:',
    ...GOOGLE_MAPS,
    'https://challenges.cloudflare.com',
    'https://accounts.google.com',
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://accounts.google.com',
  ],
  // Unsplash serves the seeded demo/stock listing photos alongside Cloudinary uploads.
  'img-src': [
    "'self'",
    'data:',
    'blob:',
    'https://res.cloudinary.com',
    'https://images.unsplash.com',
    ...GOOGLE_MAPS,
  ],
  'font-src': ["'self'", 'https://fonts.gstatic.com'],
  'connect-src': [
    "'self'",
    origin(process.env.NEXT_PUBLIC_API_URL),
    'https://api.cloudinary.com',
    'https://*.googleapis.com',
    '*.google.com',
    'https://*.gstatic.com',
    'https://accounts.google.com',
    'https://challenges.cloudflare.com',
    sentryOrigin,
    'data:',
    'blob:',
  ],
  'frame-src': [
    '*.google.com',
    'https://challenges.cloudflare.com',
    'https://accounts.google.com',
    'https://www.youtube-nocookie.com',
    'https://www.instagram.com',
  ],
  'worker-src': ["'self'", 'blob:'],
  // eSewa takes a form POST from the plan page (Khalti is a plain redirect).
  'form-action': ["'self'", 'https://rc-epay.esewa.com.np', 'https://epay.esewa.com.np'],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'frame-ancestors': ["'none'"],
}
const cspValue = Object.entries(csp)
  .map(([directive, sources]) => [directive, ...sources.filter(Boolean)].join(' '))
  .join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // "Near me" and the map pin use geolocation; nothing else is needed.
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), payment=(), usb=(), geolocation=(self)',
  },
  // Development needs eval and websockets for hot reload, so the CSP is production only.
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Content-Security-Policy', value: cspValue }]
    : []),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The end-to-end tests build into their own folder so they never overwrite a dev build.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  poweredByHeader: false,
  images: {
    // Cloudinary resizes (f_auto,q_auto, width per breakpoint); only its host is allowed.
    loader: 'custom',
    loaderFile: './src/lib/cloudinaryLoader.js',
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
    ],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
