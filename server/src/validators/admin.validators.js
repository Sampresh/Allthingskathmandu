import { z } from 'zod'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../lib/cursor.js'
import { DAYS } from '../lib/hours.js'
import { slug } from './common.js'

// ---------- Shared pieces ----------

export const idParams = z.object({ id: z.uuid() })
const limit = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
const cursor = z.string().max(1000).optional()
const search = z.string().trim().max(100).optional()

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
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{1,19}$/, 'Enter a valid phone number')

// Group slugs become top-level URLs, so they may not take an app route (Part 3 §8).
export const RESERVED_SLUGS = [
  'search',
  'events',
  'market',
  'listing',
  'account',
  'business',
  'admin',
  'api',
  'about',
  'contact',
  'terms',
  'privacy',
  'refund',
  'login',
  'register',
]

const hhmm = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/, 'Use HH:MM')
const slot = z
  .tuple([hhmm, hhmm])
  .refine(
    ([open, close]) => open !== close && open !== '24:00',
    'Opening and closing times must differ',
  )
// Every day present; a missing day means closed.
export const hoursSchema = z
  .object(Object.fromEntries(DAYS.map((d) => [d, z.array(slot).max(4).optional()])))
  .transform((h) => Object.fromEntries(DAYS.map((d) => [d, h[d] ?? []])))

export const locationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

// ---------- Listings ----------

const listingFields = {
  name: text(120).min(1),
  nameNe: optionalText(120),
  type: z.enum(['BUSINESS', 'APP', 'PLACE', 'HOTLINE']),
  slug: slug.optional(),
  shortDesc: text(120).min(1),
  description: optionalText(600),
  logoUrl: cloudinaryUrl.nullable().optional(),
  phone: phone.nullable().optional(),
  whatsapp: phone.nullable().optional(),
  email: z.email().nullable().optional(),
  website: optionalUrl,
  playStoreUrl: optionalUrl,
  appStoreUrl: optionalUrl,
  address: optionalText(200),
  areaId: z.uuid().nullable().optional(),
  location: locationSchema.nullable().optional(),
  hours: hoursSchema.nullable().optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  status: z.enum(['DRAFT', 'PENDING', 'LIVE', 'SUSPENDED']).optional(),
  isVerified: z.boolean().optional(),
  // First id is the primary category.
  categoryIds: z.array(z.uuid()).min(1).max(5),
  tagIds: z.array(z.uuid()).max(20).optional(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
}

export const listingCreate = z.object(listingFields)
export const listingUpdate = z.object(listingFields).partial()

export const listingListQuery = z.object({
  q: search,
  status: z.enum(['DRAFT', 'PENDING', 'LIVE', 'SUSPENDED']).optional(),
  category: z.uuid().optional(),
  area: z.uuid().optional(),
  cursor,
  limit,
})

export const listingStatusBody = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'LIVE', 'SUSPENDED']),
})

export const assignOwnerBody = z
  .object({ userId: z.uuid().optional(), email: z.email().optional() })
  .refine((v) => v.userId || v.email, 'Send userId or email')

export const importBody = z.object({ csv: z.string().min(1).max(2_000_000) })
export const jobParams = z.object({ jobId: z.string().min(1).max(100) })

// ---------- Moderation ----------

export const moderationQuery = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).default('PENDING'),
  cursor,
  limit,
})

export const reportQuery = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN'),
  entityType: z.enum(['BUSINESS', 'REVIEW', 'MARKET_ITEM', 'EVENT']).optional(),
  cursor,
  limit,
})

export const reportUpdate = z.object({ status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']) })
export const rejectBody = z.object({ reason: optionalText(300) })

// ---------- Taxonomy ----------

const categoryFields = {
  kind: z.enum(['DIRECTORY', 'MARKET']),
  parentId: z.uuid().nullable().optional(),
  slug: slug.optional(),
  nameEn: text(80).min(1),
  nameNe: optionalText(80),
  icon: z
    .string()
    .regex(/^[a-z0-9-]{1,40}$/)
    .nullable()
    .optional(),
  description: optionalText(300),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isVisible: z.boolean().optional(),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
}
export const categoryCreate = z.object(categoryFields)
export const categoryUpdate = z.object(categoryFields).omit({ kind: true }).partial()
export const reorderBody = z.object({
  items: z
    .array(
      z.object({
        id: z.uuid(),
        parentId: z.uuid().nullable().optional(),
        sortOrder: z.number().int().min(0),
      }),
    )
    .min(1)
    .max(500),
})

const tagFields = {
  categoryId: z.uuid().nullable().optional(),
  slug: slug.optional(),
  nameEn: text(60).min(1),
  nameNe: optionalText(60),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
}
export const tagCreate = z.object(tagFields)
export const tagUpdate = z.object(tagFields).partial()

const areaFields = {
  slug: slug.optional(),
  nameEn: text(60).min(1),
  nameNe: optionalText(60),
  district: z.enum(['Kathmandu', 'Lalitpur', 'Bhaktapur']),
  center: locationSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(10_000).optional(),
  isVisible: z.boolean().optional(),
}
export const areaCreate = z.object(areaFields)
export const areaUpdate = z.object(areaFields).partial()

const synonymFields = {
  term: text(60).min(1).toLowerCase(),
  synonyms: z.array(text(60).min(1).toLowerCase()).min(1).max(20),
}
export const synonymCreate = z.object(synonymFields)
export const synonymUpdate = z.object(synonymFields).partial()

// ---------- Homepage, pages, settings ----------

const relativeOrHttps = z
  .string()
  .max(300)
  .refine(
    (v) => /^\/(?![/\\])/.test(v) || /^https:\/\//.test(v),
    'Use a site path (/…) or an https link',
  )

const sectionConfig = z
  .object({
    limit: z.number().int().min(1).max(24).optional(),
    businessIds: z.array(z.uuid()).max(24).optional(),
    body: text(200).optional(),
    ctaLabel: text(40).optional(),
    href: relativeOrHttps.optional(),
  })
  .strict()

const sectionFields = {
  type: z.enum([
    'GROUPS',
    'OPEN_NOW',
    'FEATURED',
    'POPULAR',
    'EVENTS',
    'MARKET',
    'BANNER',
    'CUSTOM_LIST',
  ]),
  title: optionalText(80),
  config: sectionConfig.nullable().optional(),
  isActive: z.boolean().optional(),
}
export const sectionCreate = z.object(sectionFields)
export const sectionUpdate = z.object(sectionFields).omit({ type: true }).partial()
export const sectionReorder = z.object({ ids: z.array(z.uuid()).min(1).max(100) })

// CMS pages have fixed public routes (Part 3 §13).
export const CMS_PAGES = ['about', 'contact', 'terms', 'privacy', 'refund']
const pageFields = {
  slug: z.enum(CMS_PAGES),
  title: text(120).min(1),
  body: z.string().max(100_000),
  seoTitle: optionalText(70),
  seoDescription: optionalText(160),
  isPublished: z.boolean().optional(),
}
export const pageCreate = z.object(pageFields)
export const pageUpdate = z.object(pageFields).omit({ slug: true }).partial()

export const SETTING_SCHEMAS = {
  emergency_numbers: z
    .array(
      z.object({
        label: text(40).min(1),
        number: z
          .string()
          .trim()
          .regex(/^[0-9+ ()-]{2,20}$/),
      }),
    )
    .max(12),
  contact: z.object({
    email: z.email().nullable().optional(),
    phone: phone.nullable().optional(),
    address: optionalText(200),
  }),
  social_links: z.array(z.object({ platform: text(30).min(1), url: httpUrl })).max(10),
}
export const settingParams = z.object({ key: z.enum(Object.keys(SETTING_SCHEMAS)) })
export const settingBody = z.object({ value: z.unknown() })

// ---------- Plans and payments ----------

const planFeatures = z.object({
  maxPhotos: z.number().int().min(0).max(50),
  maxVideos: z.number().int().min(0).max(10),
  featured: z.boolean(),
  homepage: z.boolean(),
})
const planFields = {
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z][A-Z0-9_]{1,30}$/),
  name: text(40).min(1),
  priceNpr: z.number().int().min(0).max(1_000_000),
  durationDays: z.number().int().min(1).max(366),
  features: planFeatures,
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(100).optional(),
}
export const planCreate = z.object(planFields)
export const planUpdate = z.object(planFields).omit({ code: true }).partial()

export const paymentQuery = z.object({
  status: z.enum(['INITIATED', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  gateway: z.enum(['KHALTI', 'ESEWA']).optional(),
  cursor,
  limit,
})

// ---------- Users, audit, cache ----------

export const userQuery = z.object({
  q: search,
  role: z.enum(['MEMBER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  cursor,
  limit,
})
export const userStatusBody = z.object({ status: z.enum(['ACTIVE', 'SUSPENDED']) })
export const userRoleBody = z.object({
  role: z.enum(['MEMBER', 'BUSINESS_OWNER', 'MODERATOR', 'ADMIN', 'SUPER_ADMIN']),
})

export const auditQuery = z.object({
  entity: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(60).optional(),
  actorId: z.uuid().optional(),
  cursor,
  limit,
})

export const cachePurgeBody = z
  .object({
    tags: z
      .array(z.string().regex(/^[\w:.-]{1,200}$/))
      .max(100)
      .optional(),
    all: z.boolean().optional(),
  })
  .refine((v) => v.all || v.tags?.length, 'Send tags or all: true')
