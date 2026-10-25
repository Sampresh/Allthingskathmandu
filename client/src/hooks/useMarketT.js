'use client'

import { useCallback } from 'react'
import { translate } from '@/lib/i18n'
import { clientMessages } from '@/lib/messages/client'
import { marketMessages } from '@/lib/messages/market'
import { useLang } from './useLang'

const allMessages = { ...clientMessages, ...marketMessages }

/** useT for the market and events pages. */
export function useMarketT() {
  const lang = useLang()
  return useCallback((key) => translate(key, lang, allMessages), [lang])
}
