import { z } from 'zod'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../lib/cursor.js'
import { slug } from './common.js'

export const MAX_MARKET_PHOTOS = 6
export const CONDITIONS = ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR']

const text = (max) => z.string().trim().max(max)
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number')
const publicId = z.string().regex(/^[\w/-]{1,200}$/)
const limit = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
const cursor = z.string().max(1000).optional()
const price = z.coerce.number().int().min(0).max(10_000_000)

export const itemSlugParams = z.object({ slug })

export const marketQuery = z
  .object({
    category: slug.optional(),
    condition: z.enum(CONDITIONS).optional(),
    min: price.optional(),
    max: price.optional(),
    area: slug.optional(),
    q: text(100).optional(),
    cursor,
    limit,
  })
  .refine((q) => q.min == null || q.max == null || q.min <= q.max, {
    path: ['max'],
    message: 'Must be at least the minimum',
  })

export const pageQuery = z.object({ cursor, limit })

const photos = z
  .array(
    z.object({
      publicId,
      altText: text(150).min(1, 'Describe the photo'),
    }),
  )
  .max(MAX_MARKET_PHOTOS, `Up to ${MAX_MARKET_PHOTOS} photos`)
  .refine((list) => new Set(list.map((p) => p.publicId)).size === list.length, 'Duplicate photo')

const itemFields = {
  title: text(100).min(3, 'Enter a title'),
  description: text(1000)
    .nullable()
    .optional()
    .transform((v) => v || null),
  priceNpr: z.number().int().min(0).max(10_000_000),
  isNegotiable: z.boolean().default(false),
  condition: z.enum(CONDITIONS),
  categoryId: z.uuid(),
  areaId: z.uuid().nullable().optional(),
  contactPhone: phone.nullable().optional(),
  contactWhatsapp: phone.nullable().optional(),
  photos: photos.default([]),
}

// Buyers reach sellers only by call or WhatsApp (no checkout, no messages).
const hasContact = (item) => Boolean(item.contactPhone || item.contactWhatsapp)

export const itemBody = z
  .object(itemFields)
  .refine(hasContact, { path: ['contactPhone'], message: 'Add a phone or WhatsApp number' })

export const itemUpdate = z
  .object(itemFields)
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update')

export const adminMarketQuery = z.object({
  status: z.enum(['PENDING', 'LIVE', 'SOLD', 'EXPIRED', 'REJECTED']).default('PENDING'),
  cursor,
  limit,
})
