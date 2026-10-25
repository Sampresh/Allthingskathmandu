import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const baseURL = process.env.NEXT_PUBLIC_API_URL
export const SESSION_HINT_COOKIE = 'atk_session'

// The access token lives only in this module's memory: never in storage or a cookie.
let accessToken = null

export const setAccessToken = (token) => {
  accessToken = token
}

/** True when the API's "logged in" hint cookie is present, so a refresh is worth trying. */
export const hasSessionHint = () =>
  typeof document !== 'undefined' &&
  document.cookie.split('; ').some((c) => c === `${SESSION_HINT_COOKIE}=1`)

/** Error shape every service call rejects with. */
export class ApiClientError extends Error {
  constructor({ status, code, message, details }) {
    super(message)
    this.name = 'ApiClientError'
    this.status = status
    this.code = code
    this.details = details ?? []
  }
}

function toClientError(error) {
  if (error instanceof ApiClientError) return error
  const body = error.response?.data?.error
  if (body) return new ApiClientError({ status: error.response.status, ...body })
  if (error.response) {
    return new ApiClientError({ status: error.response.status, code: 'HTTP_ERROR', message: '' })
  }
  return new ApiClientError({ status: 0, code: 'NETWORK', message: '' })
}

/** The one axios instance (CLAUDE.md client rules). Components use services/*, not this. */
export const api = axios.create({ baseURL, withCredentials: true, timeout: 15_000 })

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// One refresh at a time: concurrent 401s wait on the same promise (the request queue).
// Across tabs, a Web Lock makes the second tab wait so it sends the already rotated cookie
// instead of the old one, which the API would treat as token reuse.
let refreshing = null

const withRefreshLock = (fn) =>
  typeof navigator !== 'undefined' && navigator.locks
    ? navigator.locks.request('atk-auth-refresh', fn)
    : fn()

export function refreshSession() {
  refreshing ??= withRefreshLock(() =>
    axios.post(`${baseURL}/auth/refresh`, null, { withCredentials: true, timeout: 15_000 }),
  )
    .then((res) => {
      const { accessToken: token, user } = res.data.data
      setAccessToken(token)
      useAuthStore.getState().setUser(user)
      return token
    })
    .catch((error) => {
      setAccessToken(null)
      useAuthStore.getState().clear()
      throw toClientError(error)
    })
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { config, response } = error
    const retryable =
      response?.status === 401 && config && !config._retried && !config.skipAuthRefresh
    if (!retryable) throw toClientError(error)

    config._retried = true
    try {
      await refreshSession()
    } catch {
      throw toClientError(error)
    }
    return api(config)
  },
)

/** Unwraps the { success, data, meta } envelope. */
export const unwrap = (response) => response.data.data
export const unwrapWithMeta = (response) => ({ data: response.data.data, meta: response.data.meta })
