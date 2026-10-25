import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { logger } from '../utils/logger.js'

const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'
const TIMEOUT_MS = 5000

let warned = false

/**
 * Verifies a Cloudflare Turnstile token server-side (guest forms). env.js requires the
 * secret in production; without it (local dev, tests) the check is skipped with a warning.
 */
export async function verifyTurnstile(token, ip) {
  if (!env.TURNSTILE_SECRET_KEY) {
    if (!warned)
      logger.warn('TURNSTILE_SECRET_KEY not set: bot check skipped (not allowed in production)')
    warned = true
    return
  }
  if (!token) throw ApiError.badRequest('Please complete the bot check')

  let outcome
  try {
    const res = await fetch(VERIFY_URL, {
      method: 'POST',
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET_KEY,
        response: token,
        remoteip: ip ?? '',
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    outcome = await res.json()
  } catch (err) {
    logger.error(`turnstile verification failed: ${err.message}`)
    throw ApiError.unavailable('Bot check is unavailable, please try again')
  }
  if (!outcome.success)
    throw new ApiError(400, 'TURNSTILE_FAILED', 'Bot check failed, please try again')
}
