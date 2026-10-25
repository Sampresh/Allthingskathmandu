import { api, setAccessToken, unwrap } from './api'
import { useAuthStore } from '@/store/authStore'

// Auth endpoints never trigger the refresh-and-retry flow.
const noRefresh = { skipAuthRefresh: true }

/** Stores a completed sign-in: token in memory, user in the auth store. */
export function completeSignIn({ accessToken, user }) {
  setAccessToken(accessToken)
  useAuthStore.getState().setUser(user)
  return user
}

export const register = (body) => api.post('/auth/register', body, noRefresh).then(unwrap)

export const verifyEmail = (token) =>
  api.post('/auth/verify-email', { token }, noRefresh).then(unwrap)

export const resendVerification = (email) =>
  api.post('/auth/resend-verification', { email }, noRefresh).then(unwrap)

/** Resolves to either { accessToken, user } or { twoFactor: 'setup' | 'verify', challengeToken }. */
export const login = (body) => api.post('/auth/login', body, noRefresh).then(unwrap)

export const loginWithGoogle = (idToken) =>
  api.post('/auth/google', { idToken }, noRefresh).then(unwrap)

export const setupTwoFactor = (challengeToken) =>
  api.post('/auth/2fa/setup', { challengeToken }, noRefresh).then(unwrap)

export const enableTwoFactor = (challengeToken, code) =>
  api.post('/auth/2fa/enable', { challengeToken, code }, noRefresh).then(unwrap)

export const verifyTwoFactor = (challengeToken, code) =>
  api.post('/auth/2fa/verify', { challengeToken, code }, noRefresh).then(unwrap)

export const forgotPassword = (email) =>
  api.post('/auth/forgot-password', { email }, noRefresh).then(unwrap)

export const resetPassword = (token, password) =>
  api.post('/auth/reset-password', { token, password }, noRefresh).then(unwrap)

export async function logout() {
  try {
    await api.post('/auth/logout', null, noRefresh)
  } finally {
    setAccessToken(null)
    useAuthStore.getState().clear()
  }
}

export async function logoutAll() {
  try {
    await api.post('/auth/logout-all')
  } finally {
    setAccessToken(null)
    useAuthStore.getState().clear()
  }
}

/** Where to go after signing in, by role. */
export function homeFor(user) {
  if (['MODERATOR', 'ADMIN', 'SUPER_ADMIN'].includes(user.role)) return '/admin'
  if (user.role === 'BUSINESS_OWNER') return '/business/dashboard'
  return '/account/profile'
}

/** Only same-site relative paths are allowed as ?next= targets (no open redirects). */
export function safeNext(next) {
  return typeof next === 'string' && /^\/(?![/\\])/.test(next) ? next : null
}
