import { z } from 'zod'

const MAX_PASSWORD_BYTES = 72 // bcrypt ignores anything longer

export const email = z.string().trim().toLowerCase().max(254).pipe(z.email('Enter a valid email'))

export const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .refine((v) => Buffer.byteLength(v, 'utf8') <= MAX_PASSWORD_BYTES, 'Password is too long')

const opaqueToken = z.string().trim().min(20).max(200)
const challengeToken = z.string().min(1).max(2048)
const totpCode = z
  .string()
  .trim()
  .regex(/^\d{6}$/, 'Enter the 6-digit code')
const turnstileToken = z.string().max(4096).optional()

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Enter your name').max(100),
  email,
  password,
  turnstileToken,
})

export const verifyEmailSchema = z.object({ token: opaqueToken })

export const emailOnlySchema = z.object({ email })

export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(1024),
})

export const googleSchema = z.object({ idToken: z.string().min(1).max(4096) })

export const resetPasswordSchema = z.object({ token: opaqueToken, password })

export const challengeSchema = z.object({ challengeToken })

export const challengeCodeSchema = z.object({ challengeToken, code: totpCode })
