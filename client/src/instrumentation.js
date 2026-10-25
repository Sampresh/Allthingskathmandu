// Server-side error reporting for the web app (server components, route handlers, proxy).
// The SDK is only loaded when a DSN is configured.

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

export async function register() {
  if (!dsn) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
    tracesSampleRate: 0,
    sendDefaultPii: false,
  })
}

export async function onRequestError(...args) {
  if (!dsn) return
  const Sentry = await import('@sentry/nextjs')
  Sentry.captureRequestError(...args)
}
