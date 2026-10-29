/** Lower-case words only: "16 Paknajol Marg, Thamel" → " 16 paknajol marg thamel ". */
const normalize = (text) =>
  ` ${String(text)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()} `

/** Comma-separated parts of an address, lower-cased, house numbers and wards dropped. */
export function addressParts(address) {
  return String(address)
    .split(',')
    .map((p) => normalize(p).replace(/ \d+ /g, ' ').trim())
    .filter(Boolean)
}

/**
 * The area an address is in, matched on whole words against each area's name, slug and
 * aliases. When several match, the one named earliest in the address wins (addresses go from
 * specific to general: "Kwabahal, Thamel Marg, Kathmandu"), then the longest name.
 * areas: [{ id, slug, nameEn, aliases }]. Returns the area or null.
 */
export function matchArea(address, areas) {
  if (!address) return null
  const text = normalize(address)
  let best = null
  for (const area of areas) {
    const terms = [area.nameEn, area.slug.replace(/-/g, ' '), ...(area.aliases ?? [])]
    for (const term of terms) {
      const needle = normalize(term)
      if (needle.trim() === '') continue
      const at = text.indexOf(needle)
      if (at === -1) continue
      if (!best || at < best.at || (at === best.at && needle.length > best.length)) {
        best = { area, at, length: needle.length }
      }
    }
  }
  return best?.area ?? null
}
