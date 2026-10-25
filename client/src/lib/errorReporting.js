// Browser error reporting (Part 3 §9) without the Sentry SDK in the first page load
// (Part 4 §9 JS budget): the inline script from lib/errorBuffer.js buffers errors from the
// start, and the SDK loads when the browser is idle, or straight away on the first error.
// This module is itself loaded on demand (see lib/reportError.js).

const DSN = process.env.NEXT_PUBLIC_SENTRY_DSN

let loading = null

function loadSentry() {
  if (!DSN) return Promise.resolve(null)
  loading ??= import('@sentry/nextjs')
    .then((Sentry) => {
      Sentry.init({
        dsn: DSN,
        environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
        // Errors only: no tracing, replay or personal data.
        tracesSampleRate: 0,
        sendDefaultPii: false,
      })
      // Errors caught by the inline handler before the SDK arrived. From now on the SDK's
      // own handlers take over.
      const early = window.__atkErrors ?? []
      window.__atkErrors = null
      for (const error of early) Sentry.captureException(error)
      return Sentry
    })
    .catch(() => null)
  return loading
}

/** Called once per page load: schedules the SDK for an idle moment, or the first error. */
export function startErrorReporting() {
  if (!DSN) return
  if (window.__atkErrors?.length) {
    loadSentry()
    return
  }
  const onError = () => loadSentry()
  window.addEventListener('error', onError, { once: true })
  window.addEventListener('unhandledrejection', onError, { once: true })
  const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 3000))
  idle(() => loadSentry(), { timeout: 10_000 })
}

/** Reports an error caught by an error boundary (React does not pass these to onerror). */
export async function reportError(error) {
  const Sentry = await loadSentry()
  Sentry?.captureException(error)
}
