'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { LANG_COOKIE, translate } from '@/lib/i18n'
import { clientMessages } from '@/lib/messages/client'

const EVENT = 'atk:lang'

const subscribe = (callback) => {
  window.addEventListener(EVENT, callback)
  return () => window.removeEventListener(EVENT, callback)
}
const getSnapshot = () => (document.documentElement.dataset.lang === 'ne' ? 'ne' : 'en')
const getServerSnapshot = () => 'en'

/** Current UI language. For text content prefer <T>; use this for attributes. */
export function useLang() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** Translator bound to the current language, for placeholders, aria-labels and alt text. */
export function useT() {
  const lang = useLang()
  return useCallback((key) => translate(key, lang, clientMessages), [lang])
}

export function setLang(lang) {
  const root = document.documentElement
  root.dataset.lang = lang
  root.lang = lang
  document.cookie = `${LANG_COOKIE}=${lang}; path=/; max-age=31536000; samesite=lax`
  window.dispatchEvent(new Event(EVENT))
}
