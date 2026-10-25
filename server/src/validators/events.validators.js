import { z } from 'zod'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../lib/cursor.js'
import { locationSchema } from './admin.validators.js'
import { slug } from './common.js'

const text = (max) => z.string().trim().max(max)
const optionalText = (max) =>
  text(max)
    .nullable()
    .optional()
    .transform((v) => v || null)
const httpUrl = z.url({ protocol: /^https?$/ }).max(500)
const publicId = z.string().regex(/^[\w/-]{1,200}$/)
const limit = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)
const cursor = z.string().max(1000).optional()
const DAY = 24 * 60 * 60 * 1000

export const eventSlugParams = z.object({ slug })

export const eventsQuery = z
  .object({
    from: z.iso
      .datetime({ offset: true })
      .transform((v) => new Date(v))
      .optional(),
    to: z.iso
      .datetime({ offset: true })
      .transform((v) => new Date(v))
      .optional(),
    area: slug.optional(),
    cursor,
    limit,
  })
  .refine((q) => !q.from || !q.to || q.from <= q.to, {
    path: ['to'],
    message: 'Must be after from',
  })

export const pageQuery = z.object({ cursor, limit })

const eventFields = {
  title: text(120).min(3, 'Enter a title'),
  description: optionalText(1000),
  startsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  endsAt: z.iso
    .datetime({ offset: true })
    .nullable()
    .optional()
    .transform((v) => (v ? new Date(v) : null)),
  venue: optionalText(120),
  areaId: z.uuid().nullable().optional(),
  location: locationSchema.nullable().optional(),
  ticketUrl: httpUrl.nullable().optional(),
}

const timesMakeSense = (e, { future }) => {
  const issues = []
  if (future && e.startsAt && e.startsAt <= new Date())
    issues.push({ path: ['startsAt'], message: 'Pick a date in the future' })
  if (e.startsAt && e.endsAt && e.endsAt < e.startsAt)
    issues.push({ path: ['endsAt'], message: 'Must be after the start' })
  if (e.startsAt && e.endsAt && e.endsAt - e.startsAt > 31 * DAY)
    issues.push({ path: ['endsAt'], message: 'Events can run at most 31 days' })
  return issues
}

/** Member or owner submission (Part 6 §4, §5); waits for moderation. */
export const eventBody = z
  .object({ ...eventFields, coverPublicId: publicId.nullable().optional() })
  .superRefine((e, ctx) => timesMakeSense(e, { future: true }).forEach((i) => ctx.addIssue(i)))

/** Admin edit: any field; past start times are allowed (fixing an old event). */
export const eventUpdate = z
  .object(eventFields)
  .partial()
  .superRefine((e, ctx) => timesMakeSense(e, { future: false }).forEach((i) => ctx.addIssue(i)))
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update')
