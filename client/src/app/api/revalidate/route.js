import { timingSafeEqual } from 'node:crypto'
import { revalidateTag } from 'next/cache'

const MAX_TAGS = 200
const TAG = /^[\w:.-]{1,200}$/

function secretMatches(given) {
  const expected = process.env.REVALIDATE_SECRET
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/**
 * Called by the API worker after content changes: { tags: [...] } with the shared secret in
 * x-revalidate-secret. The tagged data expires at once ({ expire: 0 }, as Next recommends
 * when the change comes from another service): the next request rebuilds the page instead of
 * being served the stale copy, so a listing moved to Trash is gone for the very next visitor.
 */
export async function POST(request) {
  if (!secretMatches(request.headers.get('x-revalidate-secret'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const tags = Array.isArray(body?.tags)
    ? [...new Set(body.tags.filter((t) => typeof t === 'string' && TAG.test(t)))].slice(0, MAX_TAGS)
    : []
  if (!tags.length) return Response.json({ error: 'No valid tags' }, { status: 400 })

  for (const tag of tags) revalidateTag(tag, { expire: 0 })
  return Response.json({ revalidated: tags.length })
}
