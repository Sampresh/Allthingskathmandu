import { describe, it, expect } from 'vitest'
import { parseEnv } from '../src/config/env.js'

const strong = (c) => c.repeat(48)

const base = {
  NODE_ENV: 'development',
  DATABASE_URL: 'postgresql://atk:atk@localhost:5432/atk',
  REDIS_URL: 'redis://localhost:6379',
  CLIENT_URL: 'http://localhost:3000',
  SERVER_PUBLIC_URL: 'http://localhost:5001',
  JWT_ACCESS_SECRET: strong('a'),
  JWT_REFRESH_SECRET: strong('r'),
  REVALIDATE_URL: 'http://localhost:3000/api/revalidate',
  REVALIDATE_SECRET: strong('v'),
}

const production = {
  ...base,
  NODE_ENV: 'production',
  DIRECT_URL: 'postgresql://atk:atk@db.example.com:5432/atk',
  COOKIE_DOMAIN: 'api.allthingskathmandu.com',
  CLOUDINARY_CLOUD_NAME: 'atk',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  SMTP_HOST: 'smtp.example.com',
  SMTP_USER: 'user',
  SMTP_PASS: 'pass',
  KHALTI_SECRET_KEY: 'khalti',
  ESEWA_SECRET_KEY: 'esewa',
  ESEWA_STATUS_URL: 'https://epay.example.com/status',
  TURNSTILE_SECRET_KEY: 'turnstile',
}

describe('parseEnv', () => {
  it('accepts a complete development env and applies defaults', () => {
    const { env, warnings } = parseEnv(base)
    expect(env.PORT).toBe(5001)
    expect(env.FORCE_HTTPS).toBe(false)
    expect(env.JWT_ACCESS_EXPIRY).toBe('15m')
    expect(env.isProduction).toBe(false)
    expect(warnings).toEqual([])
  })

  it('treats empty strings as unset', () => {
    const { env } = parseEnv({ ...base, DATABASE_REPLICA_URL: '', PORT: '' })
    expect(env.DATABASE_REPLICA_URL).toBeUndefined()
    expect(env.PORT).toBe(5001)
  })

  it.each([
    'DATABASE_URL',
    'REDIS_URL',
    'JWT_ACCESS_SECRET',
    'JWT_REFRESH_SECRET',
    'REVALIDATE_SECRET',
  ])('fails when %s is missing', (key) => {
    const source = { ...base }
    delete source[key]
    expect(() => parseEnv(source)).toThrow(key)
  })

  it('warns when a secret is shorter than 32 characters', () => {
    const { warnings } = parseEnv({ ...base, JWT_ACCESS_SECRET: 'short' })
    expect(warnings).toContain('JWT_ACCESS_SECRET is shorter than 32 characters')
  })

  it('only warns about identical JWT secrets outside production', () => {
    const { warnings } = parseEnv({ ...base, JWT_REFRESH_SECRET: base.JWT_ACCESS_SECRET })
    expect(warnings.some((w) => w.includes('identical'))).toBe(true)
  })

  it('accepts a complete production env', () => {
    expect(parseEnv(production).env.isProduction).toBe(true)
  })

  it('refuses identical JWT secrets in production', () => {
    expect(() =>
      parseEnv({ ...production, JWT_REFRESH_SECRET: production.JWT_ACCESS_SECRET }),
    ).toThrow('must be different')
  })

  it('refuses .env.example placeholders in production', () => {
    expect(() =>
      parseEnv({ ...production, JWT_ACCESS_SECRET: 'change-me-64-random-chars' }),
    ).toThrow('placeholder')
  })

  it('requires production-only secrets in production', () => {
    const source = { ...production }
    delete source.KHALTI_SECRET_KEY
    delete source.TURNSTILE_SECRET_KEY
    expect(() => parseEnv(source)).toThrow(/KHALTI_SECRET_KEY[\s\S]*TURNSTILE_SECRET_KEY/)
  })
})
