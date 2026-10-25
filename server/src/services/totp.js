import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { generateSecret, generateURI, verify } from 'otplib'
import QRCode from 'qrcode'
import { env } from '../config/env.js'
import { redis } from '../config/redis.js'
import { logger } from '../utils/logger.js'

const KEY = Buffer.from(env.TOTP_ENCRYPTION_KEY, 'base64')
const VERSION = 'v1'
// Accept the previous and next 30 s step to absorb clock drift on the phone.
const EPOCH_TOLERANCE_S = 30
const LAST_STEP_TTL_S = 5 * 60

// ---------- Encryption at rest (AES-256-GCM) ----------

export function encryptSecret(plain) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', KEY, iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return [VERSION, iv, tag, data]
    .map((p) => (Buffer.isBuffer(p) ? p.toString('base64url') : p))
    .join(':')
}

export function decryptSecret(stored) {
  const [version, iv, tag, data] = stored.split(':')
  if (version !== VERSION) throw new Error('unknown TOTP secret format')
  const decipher = createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64url'))
  decipher.setAuthTag(Buffer.from(tag, 'base64url'))
  return Buffer.concat([
    decipher.update(Buffer.from(data, 'base64url')),
    decipher.final(),
  ]).toString('utf8')
}

// ---------- Setup and verification ----------

/** New secret for an authenticator app: { secret, encrypted, otpauthUrl, qrCode (data URL) }. */
export async function createTotpSetup(email) {
  const secret = generateSecret()
  const otpauthUrl = generateURI({ issuer: env.TOTP_ISSUER, label: email, secret })
  return {
    secret,
    encrypted: encryptSecret(secret),
    otpauthUrl,
    qrCode: await QRCode.toDataURL(otpauthUrl),
  }
}

const lastStepKey = (userId) => `totp:last:${userId}`

async function lastUsedStep(userId) {
  try {
    const value = await redis.get(lastStepKey(userId))
    return value ? Number(value) : undefined
  } catch {
    return undefined
  }
}

/**
 * Checks a 6-digit code against the user's encrypted secret. A code is accepted once:
 * the matched time step is remembered in Redis so the same code cannot be replayed.
 */
export async function verifyTotpCode(userId, encryptedSecret, code) {
  const secret = decryptSecret(encryptedSecret)
  const result = await verify({
    secret,
    token: code,
    epochTolerance: EPOCH_TOLERANCE_S,
    afterTimeStep: await lastUsedStep(userId),
  })
  if (!result.valid) return false
  try {
    await redis.set(lastStepKey(userId), String(result.timeStep), 'EX', LAST_STEP_TTL_S)
  } catch (err) {
    logger.warn(`totp replay guard unavailable: ${err.message}`)
  }
  return true
}
