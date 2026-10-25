import slugifyLib from 'slugify'

/** URL slug from English text: "Eat & Drink" → "eat-and-drink". */
export function slugify(text) {
  return slugifyLib(String(text), { lower: true, strict: true, trim: true })
}

/**
 * First free slug: base, base-2, base-3 … `taken(slug)` resolves true when in use.
 * Text without Latin letters (e.g. only Nepali) falls back to `fallback`.
 */
export async function uniqueSlug(text, taken, fallback = 'item') {
  const base = slugify(text).slice(0, 80).replace(/-+$/, '') || fallback
  for (let n = 1; n < 1000; n += 1) {
    const candidate = n === 1 ? base : `${base}-${n}`
    if (!(await taken(candidate))) return candidate
  }
  throw new Error(`no free slug for ${base}`)
}
