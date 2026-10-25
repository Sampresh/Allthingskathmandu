import { z } from 'zod'
import { hoursSchema, idParams, locationSchema } from './admin.validators.js'

export { idParams }

const text = (max) => z.string().trim().max(max)
const optionalText = (max) =>
  text(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))
const httpUrl = z.url({ protocol: /^https?$/ }).max(500)
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{1,19}$/, 'Enter a valid phone number')
const publicId = z.string().regex(/^[\w/-]{1,200}$/)

// What an owner may change (Part 6 §5): names, descriptions, contacts, categories, tags,
// price level and logo. Status, slug and verification stay with Admin.
export const ownerListingUpdate = z
  .object({
    name: text(120).min(1),
    nameNe: optionalText(120),
    shortDesc: text(120).min(1),
    description: optionalText(600),
    phone: phone.nullable().optional(),
    whatsapp: phone.nullable().optional(),
    email: z.email().nullable().optional(),
    website: httpUrl.nullable().optional(),
    playStoreUrl: httpUrl.nullable().optional(),
    appStoreUrl: httpUrl.nullable().optional(),
    priceLevel: z.number().int().min(1).max(4).nullable().optional(),
    categoryIds: z.array(z.uuid()).min(1).max(5),
    tagIds: z.array(z.uuid()).max(20),
    // Result of a signed logo upload; null removes the logo.
    logoPublicId: publicId.nullable(),
  })
  .partial()

export const hoursBody = z.object({ hours: hoursSchema.nullable() })

export const locationBody = locationSchema.extend({
  address: optionalText(200),
  areaId: z.uuid().nullable().optional(),
})

export const mediaBody = z.discriminatedUnion('type', [
  z.object({ type: z.literal('PHOTO'), publicId, altText: text(150).min(1, 'Describe the photo') }),
  z.object({
    type: z.literal('VIDEO'),
    url: httpUrl,
    altText: text(150).min(1, 'Give the video a title'),
  }),
])

export const mediaParams = z.object({ id: z.uuid(), mediaId: z.uuid() })
export const mediaOrderBody = z.object({ ids: z.array(z.uuid()).min(1).max(100) })

const offerFields = {
  title: text(80).min(1),
  body: optionalText(300),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
  isActive: z.boolean().optional(),
}
const endsAfterStart = (o) => !o.startsAt || !o.endsAt || o.endsAt > o.startsAt
export const offerCreate = z
  .object(offerFields)
  .refine(endsAfterStart, { message: 'Must end after it starts', path: ['endsAt'] })
export const offerUpdate = z
  .object(offerFields)
  .partial()
  .refine(endsAfterStart, { message: 'Must end after it starts', path: ['endsAt'] })
export const offerParams = z.object({ id: z.uuid(), offerId: z.uuid() })

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
export const statsQuery = z.object({ from: day.optional(), to: day.optional() })

// Member side: claims and "List your business".
export const claimBody = z
  .object({
    businessId: z.uuid(),
    note: optionalText(1000),
    proofPublicId: publicId.optional(),
  })
  .refine((v) => v.note || v.proofPublicId, {
    message: 'Tell us how to verify you, or add a document',
    path: ['note'],
  })

export const newListingBody = z.object({
  name: text(120).min(1),
  shortDesc: text(120).min(1),
  categoryIds: z.array(z.uuid()).min(1).max(5),
  phone: phone.nullable().optional(),
  whatsapp: phone.nullable().optional(),
  website: httpUrl.nullable().optional(),
  address: optionalText(200),
  areaId: z.uuid().nullable().optional(),
})
