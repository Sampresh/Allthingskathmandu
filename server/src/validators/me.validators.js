import { z } from 'zod'
import { DEFAULT_LIMIT, MAX_LIMIT } from '../lib/cursor.js'
import { password } from './auth.validators.js'

const name = z.string().trim().min(1, 'Enter your name').max(80)
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{6,19}$/, 'Enter a valid phone number')
const currentPassword = z.string().min(1, 'Enter your current password').max(1024)
const reviewText = z
  .string()
  .trim()
  .max(1000, 'Keep it under 1000 characters')
  .transform((v) => v || null)

const page = { cursor: z.string().max(1000).optional() }
const limit = z.coerce.number().int().min(1).max(MAX_LIMIT).default(DEFAULT_LIMIT)

export const idParams = z.object({ id: z.uuid() })
export const businessParams = z.object({ businessId: z.uuid() })

export const profileBody = z
  .object({ name, phone: phone.nullable() })
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update')

// Accounts made with Google have no password yet: they can set one without `currentPassword`.
export const passwordBody = z.object({
  currentPassword: currentPassword.optional(),
  newPassword: password,
})

export const deleteAccountBody = z.object({
  password: currentPassword.optional(),
  confirm: z.literal('DELETE', { error: 'Type DELETE to confirm' }),
})

export const savedQuery = z.object({ ...page, limit, businessId: z.uuid().optional() })
export const pageQuery = z.object({ ...page, limit })

export const reviewBody = z.object({
  businessId: z.uuid(),
  rating: z.number().int().min(1).max(5),
  body: reviewText.optional(),
})

export const reviewPatchBody = z
  .object({ rating: z.number().int().min(1).max(5), body: reviewText.nullable() })
  .partial()
  .refine((b) => Object.keys(b).length > 0, 'Nothing to update')
