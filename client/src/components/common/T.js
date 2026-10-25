import { clientMessages } from '@/lib/messages/client'
import { Bilingual } from './Bilingual'

export { Bilingual }

/**
 * Text in both languages (client-safe: knows only client text; server components use ST).
 * Use `k` for UI messages, or `en` / `ne` for data (e.g.
 * category.nameEn / nameNe). Works in server and client components.
 */
export function T({ k, en, ne }) {
  const entry = k ? clientMessages[k] : { en, ne }
  if (!entry) return k
  return <Bilingual entry={entry} />
}
