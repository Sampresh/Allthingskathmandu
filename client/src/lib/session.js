// The API's non-secret "logged in" hint cookie (value "1"). No axios here, so public pages
// can check it without loading the API client.
export const SESSION_HINT_COOKIE = 'atk_session'

export const hasSessionHint = () =>
  typeof document !== 'undefined' &&
  document.cookie.split('; ').some((c) => c === `${SESSION_HINT_COOKIE}=1`)
