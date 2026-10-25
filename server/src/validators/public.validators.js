import { z } from 'zod'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../lib/cursor.js'
import { TRACK_FIELDS } from '../lib/track.js'
import { slug } from './common.js'

export { slug }

export const slugParams = z.object({ slug })

const csv = (item) =>
  z
    .string()
    .optional()
    .transform((v) =>
      v
        ? v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
        : [],
    )
    .pipe(z.array(item).max(10))

const flag = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1')

const limit = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
const cursor = z.string().max(1000).optional()

const location = {
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
}
const bothOrNeither = (v) => (v.lat === undefined) === (v.lng === undefined)
const pointOf = ({ lat, lng, ...rest }) => ({
  ...rest,
  point: lat === undefined ? null : { lat, lng },
})

export const listingsQuery = z
  .object({
    area: slug.optional(),
    tags: csv(slug),
    open: flag,
    price: csv(z.coerce.number().int().min(1).max(4)),
    rating: z.coerce.number().min(1).max(5).optional(),
    ...location,
    cursor,
    limit,
  })
  .refine(bothOrNeither, { message: 'Send both lat and lng', path: ['lat'] })
  .transform(pointOf)

export const pageQuery = z.object({ cursor, limit })

export const similarQuery = z.object({
  limit: z.coerce.number().int().min(1).max(12).default(6),
})

const q = z.string().trim().min(1, 'Enter something to search for').max(100)

export const searchQuery = z
  .object({ q, area: slug.optional(), ...location, cursor, limit })
  .refine(bothOrNeither, { message: 'Send both lat and lng', path: ['lat'] })
  .transform(pointOf)

export const suggestQuery = z.object({ q })

export const homeQuery = z
  .object(location)
  .refine(bothOrNeither, { message: 'Send both lat and lng', path: ['lat'] })
  .transform(pointOf)

export const trackBody = z.object({
  businessId: z.uuid(),
  kind: z.enum(Object.keys(TRACK_FIELDS)),
})

export const REPORT_REASONS = [
  'closed',
  'wrong_contact',
  'wrong_location',
  'wrong_hours',
  'wrong_details',
  'inappropriate',
  'spam',
  'other',
]

export const reportBody = z
  .object({
    entityType: z.enum(['BUSINESS', 'REVIEW', 'MARKET_ITEM', 'EVENT']),
    entityId: z.uuid(),
    reason: z.enum(REPORT_REASONS),
    details: z.string().trim().max(1000).optional(),
    turnstileToken: z.string().max(4096).optional(),
  })
  .refine((v) => v.reason !== 'other' || v.details, {
    message: 'Tell us what is wrong',
    path: ['details'],
  })

export const pageParams = z.object({
  slug: z.enum(['about', 'contact', 'terms', 'privacy', 'refund']),
})

export const contactBody = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  message: z.string().trim().min(10).max(2000),
  turnstileToken: z.string().max(4096).optional(),
})
