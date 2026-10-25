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
