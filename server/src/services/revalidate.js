import { env } from '../config/env.js'
import { QUEUE, enqueue } from '../jobs/queues.js'

const TIMEOUT_MS = 10_000

/**
 * Page tags for the web app's ISR cache. Pages are routed by slug, so they tag their fetches
 * with slugs; revalidation always sends both the id and the slug forms.
 */
export function pageTagsFor({ listings = [], categories = [], extra = [] }) {
  const tags = new Set(extra)
  for (const { id, slug, oldSlug } of listings) {
    for (const value of [id, slug, oldSlug]) if (value) tags.add(`listing:${value}`)
  }
  for (const { id, slug } of categories) {
    for (const value of [id, slug]) if (value) tags.add(`category:${value}`)
  }
  return [...tags]
}

/** Queues a call to the web app's /api/revalidate for these tags. */
export function queueRevalidate(tags) {
  if (!tags.length) return null
  return enqueue(QUEUE.REVALIDATE, 'revalidate', { tags })
}

/**
 * After any content change: purge the API's Redis cache for `cacheTags` and revalidate the
 * web pages for `pageTags`. Both run in the worker.
 */
export async function queueContentChange({ cacheTags = [], pageTags = [] }) {
  await Promise.all([
    cacheTags.length ? enqueue(QUEUE.CACHE, 'purge', { tags: cacheTags }) : null,
    queueRevalidate(pageTags),
  ])
}

/** Worker side: POST the tags to the web app (secret protected). */
export async function sendRevalidate(tags) {
  const res = await fetch(env.REVALIDATE_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-revalidate-secret': env.REVALIDATE_SECRET },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`revalidate failed with ${res.status}`)
  return res.json()
}
