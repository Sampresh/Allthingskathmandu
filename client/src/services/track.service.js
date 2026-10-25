/**
 * View and click counts. sendBeacon survives navigation (tapping Call or Directions leaves
 * the page); text/plain keeps it a simple request with no CORS preflight. No axios, so it
 * costs nothing on page load.
 */
export function track(businessId, kind) {
  const url = `${process.env.NEXT_PUBLIC_API_URL}/public/track`
  const body = JSON.stringify({ businessId, kind })
  try {
    if (navigator.sendBeacon?.(url, new Blob([body], { type: 'text/plain' }))) return
  } catch {
    // fall through to fetch
  }
  fetch(url, {
    method: 'POST',
    body,
    keepalive: true,
    headers: { 'content-type': 'text/plain' },
  }).catch(() => {})
}
