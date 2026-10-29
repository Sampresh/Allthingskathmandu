import 'dotenv/config'
import { z } from 'zod'

// Empty strings in .env mean "not set".
const blank = (schema) => z.preprocess((v) => (v === '' ? undefined : v), schema)

const optionalString = blank(z.string().trim().optional())
const optionalUrl = blank(z.url().optional())
const bool = blank(
  z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
)

const schema = z.object({
  NODE_ENV: blank(z.enum(['development', 'test', 'production']).default('development')),
  PORT: blank(z.coerce.number().int().positive().default(5001)),

  DATABASE_URL: z.url(),
  DIRECT_URL: optionalUrl,
  DATABASE_REPLICA_URL: optionalUrl,

  REDIS_URL: z.url(),

  CLIENT_URL: z.url(),
  SERVER_PUBLIC_URL: z.url(),
  FORCE_HTTPS: bool,
  COOKIE_DOMAIN: optionalString,

  JWT_ACCESS_SECRET: z.string().min(1),
  JWT_REFRESH_SECRET: z.string().min(1),
  JWT_ACCESS_EXPIRY: blank(z.string().default('15m')),
  JWT_REFRESH_EXPIRY: blank(z.string().default('7d')),
  TOTP_ISSUER: blank(z.string().default('All Things Kathmandu')),
  // 32 random bytes, base64 (openssl rand -base64 32): AES-256-GCM key for TOTP secrets.
  TOTP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes, base64 encoded'),
  // Staff TOTP 2FA. Turning it off is a local-development escape hatch; refused in production.
  STAFF_TWO_FACTOR: blank(
    z
      .enum(['true', 'false'])
      .default('true')
      .transform((v) => v === 'true'),
  ),
  GOOGLE_CLIENT_ID: optionalString,

  CLOUDINARY_CLOUD_NAME: optionalString,
  CLOUDINARY_API_KEY: optionalString,
  CLOUDINARY_API_SECRET: optionalString,
  CLOUDINARY_FOLDER: blank(z.string().default('atk-dev')),

  SMTP_HOST: optionalString,
  SMTP_PORT: blank(z.coerce.number().int().positive().default(587)),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,
  FROM_EMAIL: blank(z.email().default('hello@allthingskathmandu.com')),
  FROM_NAME: blank(z.string().default('All Things Kathmandu')),

  KHALTI_SECRET_KEY: optionalString,
  KHALTI_BASE_URL: blank(z.url().default('https://dev.khalti.com/api/v2')),
  ESEWA_PRODUCT_CODE: blank(z.string().default('EPAYTEST')),
  ESEWA_SECRET_KEY: optionalString,
  ESEWA_FORM_URL: blank(z.url().default('https://rc-epay.esewa.com.np/api/epay/main/v2/form')),
  ESEWA_STATUS_URL: optionalUrl,

  TURNSTILE_SECRET_KEY: optionalString,

  REVALIDATE_URL: z.url(),
  REVALIDATE_SECRET: z.string().min(1),

  ADMIN_EMAIL: blank(z.email().optional()),
  ADMIN_PASSWORD: optionalString,

  SENTRY_DSN: optionalUrl,
  LOG_LEVEL: blank(z.enum(['debug', 'info', 'warn', 'error']).default('info')),
})

// Secrets that must be at least this long; shorter ones only warn.
const STRONG_SECRET_LENGTH = 32
const LENGTH_CHECKED = ['JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET', 'REVALIDATE_SECRET']

// Required in production on top of the always-required keys above.
const PRODUCTION_REQUIRED = [
  'DIRECT_URL',
  'COOKIE_DOMAIN',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'SMTP_HOST',
  'SMTP_USER',
  'SMTP_PASS',
  'KHALTI_SECRET_KEY',
  'ESEWA_SECRET_KEY',
  'ESEWA_STATUS_URL',
  'TURNSTILE_SECRET_KEY',
]

/**
 * Validates an env source. Returns { env, warnings } or throws an Error listing every problem.
 * Kept pure so the rules can be tested without exiting the process.
 */
export function parseEnv(source) {
  const parsed = schema.safeParse(source)
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    throw new Error(`Invalid environment:\n  - ${problems.join('\n  - ')}`)
  }

  const env = parsed.data
  const isProduction = env.NODE_ENV === 'production'
  const errors = []
  const warnings = []

  if (isProduction) {
    for (const key of PRODUCTION_REQUIRED) {
      if (!env[key]) errors.push(`${key}: required in production`)
    }
    for (const key of LENGTH_CHECKED) {
      if (env[key].startsWith('change-me'))
        errors.push(`${key}: still the .env.example placeholder`)
    }
    if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
      errors.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different')
    }
    // Payment gateways must not point at their sandboxes in production.
    const sandbox = [
      ['KHALTI_BASE_URL', /\/\/dev\.khalti\.com/],
      ['ESEWA_FORM_URL', /\/\/rc(-epay)?\.esewa\.com\.np/],
      ['ESEWA_STATUS_URL', /\/\/rc(-epay)?\.esewa\.com\.np/],
    ]
    for (const [key, pattern] of sandbox) {
      if (env[key] && pattern.test(env[key])) errors.push(`${key}: still the sandbox URL`)
    }
    if (env.ESEWA_PRODUCT_CODE === 'EPAYTEST')
      errors.push('ESEWA_PRODUCT_CODE: still the sandbox code')
    if (!env.STAFF_TWO_FACTOR) errors.push('STAFF_TWO_FACTOR: staff 2FA cannot be off in production')
  } else if (env.JWT_ACCESS_SECRET === env.JWT_REFRESH_SECRET) {
    warnings.push('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET are identical (refused in production)')
  }
  if (!isProduction && !env.STAFF_TWO_FACTOR) {
    warnings.push('STAFF_TWO_FACTOR is off: staff sign in without 2FA (refused in production)')
  }

  for (const key of LENGTH_CHECKED) {
    if (env[key].length < STRONG_SECRET_LENGTH) {
      warnings.push(`${key} is shorter than ${STRONG_SECRET_LENGTH} characters`)
    }
  }

  if (errors.length) {
    throw new Error(`Invalid environment:\n  - ${errors.join('\n  - ')}`)
  }

  return { env: Object.freeze({ ...env, isProduction }), warnings }
}

function load() {
  try {
    const { env, warnings } = parseEnv(process.env)
    for (const warning of warnings) process.stderr.write(`[env] warning: ${warning}\n`)
    return env
  } catch (err) {
    process.stderr.write(`${err.message}\n`)
    process.exit(1)
  }
}

export const env = load()
