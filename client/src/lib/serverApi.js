// Server components only: reads the public API with ISR caching and tags (Part 3 §4).
import { connection } from 'next/server'

const ORIGIN = (process.env.INTERNAL_API_ORIGIN ?? 'http://localhost:5001').replace(/\/$/, '')

// Fallback revalidation; changes are pushed sooner by the worker through /api/revalidate.
export const REVALIDATE_SECONDS = 3600

const isBuild = () => process.env.NEXT_PHASE === 'phase-production-build'

/**
 * GET /api/v1/public{path}. Returns { data, meta }, or null for 404. If the API is
 * unreachable during `next build` (CI, Docker image builds), the page is left to render on
 * request instead of being cached empty for an hour; fetches stay cached by tag. At runtime
 * it throws, and ISR keeps serving the last good page.
 */
export async function publicGet(path, { tags = [], revalidate = REVALIDATE_SECONDS } = {}) {
  let res
  try {
    res = await fetch(`${ORIGIN}/api/v1/public${path}`, {
      headers: { accept: 'application/json' },
      next: { revalidate, tags },
    })
  } catch (err) {
    if (isBuild()) {
      console.warn(`[serverApi] API unreachable during build for ${path}: rendering on request`)
      await connection()
      return null
    }
    throw err
  }
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`API ${res.status} for ${path}`)
  const body = await res.json()
  return { data: body.data, meta: body.meta ?? {} }
}
