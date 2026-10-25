import * as Sentry from '@sentry/node'
import { env } from './env.js'

// Imported first by index.js and worker.js so the SDK is ready before the app loads.
// Without SENTRY_DSN (local, tests) nothing is sent.
export const sentryEnabled = Boolean(env.SENTRY_DSN)

if (sentryEnabled) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    // Render sets the deployed commit; Sentry groups errors by release with it.
    release: process.env.RENDER_GIT_COMMIT,
    // Errors only (no performance tracing), and no request bodies, cookies or IPs.
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}

/** Reports an unexpected error with extra context (no-op without a DSN). */
export function reportError(err, context = {}) {
  if (!sentryEnabled) return
  Sentry.withScope((scope) => {
    for (const [key, value] of Object.entries(context.tags ?? {})) scope.setTag(key, value)
    if (context.extra) scope.setExtras(context.extra)
    if (context.userId) scope.setUser({ id: context.userId })
    Sentry.captureException(err)
  })
}

/** Sends queued events before the process exits. */
export const flushSentry = (timeoutMs = 2000) =>
  sentryEnabled ? Sentry.flush(timeoutMs) : Promise.resolve(true)
