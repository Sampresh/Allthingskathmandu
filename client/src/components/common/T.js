import { messages } from '@/lib/i18n'

/**
 * Renders text in both languages; CSS shows the one picked by <html data-lang>.
 * Use `k` for UI messages, or `en` / `ne` for data (e.g. category.nameEn / nameNe).
 * Works in server and client components.
 */
export function T({ k, en, ne }) {
  const entry = k ? messages[k] : { en, ne }
  if (!entry) return k
  if (!entry.ne || entry.ne === entry.en) return entry.en
  return (
    <>
      <span className="i18n-en" lang="en">
        {entry.en}
      </span>
      <span className="i18n-ne" lang="ne">
        {entry.ne}
      </span>
    </>
  )
}
