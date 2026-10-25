'use client'

import { useCallback } from 'react'
import { translate } from '@/lib/i18n'
import { authMessages } from '@/lib/messages/auth'
import { clientMessages } from '@/lib/messages/client'
import { useLang } from './useLang'

const allMessages = { ...clientMessages, ...authMessages }

/** useT for the auth pages: also knows the auth-only messages. */
export function useAuthT() {
  const lang = useLang()
  return useCallback((key) => translate(key, lang, allMessages), [lang])
}
