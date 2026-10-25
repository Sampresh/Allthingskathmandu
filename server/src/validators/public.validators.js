import { z } from 'zod'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../lib/cursor.js'
import { TRACK_FIELDS } from '../services/stats.js'

export const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Invalid slug')
  .max(160)

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
