import { SITE_URL } from '@/lib/site'

export default function robots() {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Private areas and one-time token links.
        disallow: [
          '/admin$',
          '/admin/',
          '/business$',
          '/business/',
          '/account$',
          '/account/',
          '/verify-email',
          '/reset-password',
          '/api/',
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
