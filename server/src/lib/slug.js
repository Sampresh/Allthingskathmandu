import slugifyLib from 'slugify'

/** URL slug from English text: "Eat & Drink" → "eat-and-drink". */
export function slugify(text) {
  return slugifyLib(String(text), { lower: true, strict: true, trim: true })
}
