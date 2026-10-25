// English / Nepali UI text (Part 4 §1). Each message holds both languages so pages can render
// both into the cached HTML; data names use the nameEn / nameNe fields instead.
// Text is split so public pages never ship the auth pages' messages (Part 4 §9 JS budget):
// client components use T / useT (client text only), server components use ST (all
// public text), and login, register and password pages use AuthT / useAuthT.
import { clientMessages } from './messages/client'

export const LANG_COOKIE = 'atk_lang'
export const LANGS = ['en', 'ne']

export function translate(key, lang = 'en', dictionary = clientMessages) {
  const entry = dictionary[key]
  if (!entry) return key
  return entry[lang] ?? entry.en
}

/**
 * Message for an API error: a translated message for known codes, else the server's own
 * message (always English), else a generic one. Returns { en, ne }.
 */
export function errorText(error, messages = clientMessages) {
  const known = error?.code && messages[`e.${error.code}`]
  if (known) return known
  if (error?.message) return { en: error.message, ne: error.message }
  return clientMessages['e.default']
}
