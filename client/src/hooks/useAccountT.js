'use client'

import { useCallback } from 'react'
import { translate } from '@/lib/i18n'
import { accountMessages } from '@/lib/messages/account'
import { clientMessages } from '@/lib/messages/client'
import { marketMessages } from '@/lib/messages/market'
import { useLang } from './useLang'

export const allAccountMessages = { ...clientMessages, ...marketMessages, ...accountMessages }

/** useT for the member area and the review form: also knows the account-only messages. */
export function useAccountT() {
  const lang = useLang()
  return useCallback((key) => translate(key, lang, allAccountMessages), [lang])
}
