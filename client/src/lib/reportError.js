// Entry points for the rest of the app. Each loads lib/errorReporting.js on demand, so pages
// ship only this stub; without a DSN it is removed from the build entirely.
const enabled = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN)

export function startErrorReporting() {
  if (enabled) import('./errorReporting').then((m) => m.startErrorReporting())
}

/** For error boundaries: React does not pass the errors they catch to window.onerror. */
export function reportError(error) {
  if (enabled) import('./errorReporting').then((m) => m.reportError(error))
}
