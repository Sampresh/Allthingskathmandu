import { env } from './env.js'

export const REFRESH_COOKIE = 'atk_rt'
// Non-secret "is logged in" hint, value "1". The web app's proxy.js cannot see the refresh
// cookie (it belongs to the API host), and the browser uses the hint to decide whether a
// refresh is worth trying on page load, so it is readable by JavaScript. Real auth is
// always enforced by the API.
export const SESSION_HINT_COOKIE = 'atk_session'

const REFRESH_PATH = '/api/v1/auth'

// The hint must be readable on the web app's host: use CLIENT_URL's host as the cookie
// domain (the API at api.<domain> may set cookies for its parent). Hosts like localhost
// cannot be a cookie domain; there the cookie is host-only and shared across ports.
function hintDomain() {
  const host = new URL(env.CLIENT_URL).hostname
  return host.includes('.') && !/^[\d.]+$/.test(host) ? host : undefined
}

const base = { secure: env.isProduction, sameSite: 'lax', httpOnly: true }

export function setAuthCookies(res, refreshToken, expiresAt) {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now())
  res.cookie(REFRESH_COOKIE, refreshToken, {
    ...base,
    path: REFRESH_PATH,
    domain: env.COOKIE_DOMAIN || undefined,
    maxAge,
  })
  res.cookie(SESSION_HINT_COOKIE, '1', {
    ...base,
    httpOnly: false,
    path: '/',
    domain: hintDomain(),
    maxAge,
  })
}

export function clearAuthCookies(res) {
  res.clearCookie(REFRESH_COOKIE, {
    ...base,
    path: REFRESH_PATH,
    domain: env.COOKIE_DOMAIN || undefined,
  })
  res.clearCookie(SESSION_HINT_COOKIE, {
    ...base,
    httpOnly: false,
    path: '/',
    domain: hintDomain(),
  })
}
