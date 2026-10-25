// Inline <script> for the root layout (server only): buffers errors from the start of the
// page until lib/errorReporting.js loads the Sentry SDK. Nothing when no DSN is set.
export const ERROR_BUFFER_SCRIPT = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? "window.__atkErrors=[];addEventListener('error',function(e){window.__atkErrors&&window.__atkErrors.push(e.error||new Error(e.message))});addEventListener('unhandledrejection',function(e){window.__atkErrors&&window.__atkErrors.push(e.reason)})"
  : null
