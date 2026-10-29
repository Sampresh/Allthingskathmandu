import { z } from 'zod'

/*
 * Listing rules shared by the API and the admin form. This file is copied verbatim to
 * client/src/lib/listingSchema.js (tests/listingSchema.test.js fails when the two differ), so
 * it may import only zod.
 */

export const LISTING_TYPES = ['BUSINESS', 'APP', 'PLACE', 'HOTLINE']
export const LISTING_STATUSES = ['DRAFT', 'PENDING', 'LIVE', 'SUSPENDED']
export const WEEK_DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
// What staff confirm with the business before publishing.
export const VERIFICATION_ITEMS = ['phone', 'hours', 'location', 'logo', 'description']
export const SHORT_DESC_MAX = 120
// Publish rules are suggestions for now: listings may go LIVE with any fields filled in.
// Set to true to block publishing until publishProblems() is empty.
export const PUBLISH_RULES_ENFORCED = false
export const DESCRIPTION_MAX = 600

const text = (max) => z.string().trim().max(max)
const optionalText = (max) =>
  text(max)
    .nullable()
    .optional()
    .transform((v) => (v === '' ? null : v))
const httpUrl = z.url({ protocol: /^https?$/ }).max(500)
const optionalUrl = httpUrl.nullable().optional()
// Logos and photos are uploaded to Cloudinary only.
const cloudinaryUrl = httpUrl.refine(
  (v) => v.startsWith('https://res.cloudinary.com/'),
  'Must be a Cloudinary URL',
)

// E.164 or local numbers; hotlines may also be 3 or 4 digit short codes (100, 1144).
const SHORT_CODE = /^\d{3,4}$/
export const isShortCode = (value) => SHORT_CODE.test(value ?? '')
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{1,19}$/, 'Enter a valid phone number')

/** Message when a phone number does not suit the listing type, else null. */
export function phoneProblem(type, phone) {
  if (phone && type && type !== 'HOTLINE' && isShortCode(phone))
    return 'Short codes are for hotlines only; enter the full number'
  return null
}

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case letters, numbers and dashes')
  .max(160)

// Weekly hours: { mon: [["09:00","18:00"]], ... }. A slot that closes before it opens runs past
// midnight and belongs to the opening day; "24:00" closes at midnight.
const hhmm = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Use HH:MM')
const slot = z
  .tuple([hhmm, hhmm])
  .refine(
    ([open, close]) => open !== close && open !== '24:00',
    'Opening and closing times must differ',
  )
// Every day present; a missing day means closed.
export const hoursSchema = z
  .object(Object.fromEntries(WEEK_DAYS.map((d) => [d, z.array(slot).max(4).optional()])))
  .transform((h) => Object.fromEntries(WEEK_DAYS.map((d) => [d, h[d] ?? []])))

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

export const verificationSchema = z
  .object(Object.fromEntries(VERIFICATION_ITEMS.map((k) => [k, z.boolean().optional()])))
  .transform((v) => Object.fromEntries(VERIFICATION_ITEMS.map((k) => [k, v[k] === true])))

// Every field is optional: staff fill in what they know.
export const listingFields = {
  name: text(120).optional(),
  nameNe: optionalText(120),
  type: z.enum(LISTING_TYPES).optional(),
  slug: slugSchema.optional(),
  // May stay empty while a listing is a draft; publishing requires it.
  shortDesc: text(SHORT_DESC_MAX).optional(),
  description: optionalText(DESCRIPTION_MAX),
  logoUrl: cloudinaryUrl.nullable().optional(),
  phone: phoneSchema.nullable().optional(),
  whatsapp: phoneSchema.nullable().optional(),
  email: z.email().nullable().optional(),
  website: optionalUrl,
  playStoreUrl: optionalUrl,
  appStoreUrl: optionalUrl,
  address: optionalText(200),
  areaId: z.uuid().nullable().optional(),
  location: locationSchema.nullable().optional(),
  hours: hoursSchema.nullable().optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  status: z.enum(LISTING_STATUSES).optional(),
  isVerified: z.boolean().optional(),
  verification: verificationSchema.nullable().optional(),
  featuredUntil: z.iso.datetime({ offset: true }).nullable().optional(),
  // First id is the primary category.
  categoryIds: z.array(z.uuid()).max(5).optional(),
  tagIds: z.array(z.uuid()).max(20).optional(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  googlePlaceId: z
    .string()
    .trim()
    .regex(/^[\w-]{10,300}$/, 'Not a Google place id')
    .nullable()
    .optional(),
  adminNote: optionalText(2000),
}

const checkPhone = (value, ctx) => {
  const message = phoneProblem(value.type, value.phone)
  if (message) ctx.addIssue({ code: 'custom', path: ['phone'], message })
}

export const listingCreate = z.object(listingFields).superRefine(checkPhone)
export const listingUpdate = z.object(listingFields).partial().superRefine(checkPhone)

const filled = (value) =>
  value !== null && value !== undefined && (typeof value !== 'string' || value.trim() !== '')
const hasHours = (hours) => Boolean(hours) && typeof hours === 'object'

/**
 * What stops a listing going LIVE, as [{ field, message }] (empty when it may publish).
 * listing: { type, shortDesc, categoryIds, areaId, location, phone, hours, logoUrl, website,
 * playStoreUrl, appStoreUrl, verification }.
 */
export function publishProblems(listing) {
  const problems = []
  const need = (ok, field, message) => ok || problems.push({ field, message })
  const verified = listing.verification ?? {}

  switch (listing.type) {
    case 'APP':
      need(filled(listing.shortDesc), 'shortDesc', 'Add a short description')
      need(filled(listing.logoUrl), 'logoUrl', 'Add a logo')
      need(
        filled(listing.website) || filled(listing.playStoreUrl) || filled(listing.appStoreUrl),
        'website',
        'Add a website or an app store link',
      )
      break
    case 'HOTLINE':
      need(filled(listing.phone), 'phone', 'Add the number')
      break
    default:
      need(listing.categoryIds?.length > 0, 'categoryIds', 'Pick a primary category')
      need(filled(listing.areaId), 'areaId', 'Pick an area')
      need(Boolean(listing.location), 'location', 'Pin the map location')
      need(filled(listing.shortDesc), 'shortDesc', 'Add a short description')
      if (filled(listing.phone))
        need(verified.phone === true, 'verification.phone', 'Confirm the phone number')
      if (hasHours(listing.hours))
        need(verified.hours === true, 'verification.hours', 'Confirm the opening hours')
  }
  return problems
}

// Fields that make a listing complete, by type.
const SCORED = {
  common: ['shortDesc', 'description', 'logoUrl', 'categoryIds'],
  BUSINESS: ['phone', 'whatsapp', 'website', 'address', 'areaId', 'location', 'hours'],
  PLACE: ['phone', 'website', 'address', 'areaId', 'location', 'hours'],
  APP: ['website', 'playStoreUrl', 'appStoreUrl'],
  HOTLINE: ['phone'],
}

/** 0 to 100: share of the fields that matter for this type that are filled in. */
export function profileScore(listing) {
  const fields = [...SCORED.common, ...(SCORED[listing.type] ?? SCORED.BUSINESS)]
  const done = fields.filter((field) => {
    const value = listing[field]
    if (field === 'categoryIds') return Array.isArray(value) && value.length > 0
    if (field === 'hours') return hasHours(value)
    if (field === 'location') return Boolean(value)
    return filled(value)
  }).length
  return Math.round((done / fields.length) * 100)
}
