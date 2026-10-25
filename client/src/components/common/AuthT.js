import { authMessages } from '@/lib/messages/auth'
import { allPublicMessages } from './ST'
import { Bilingual } from './Bilingual'

/** T for the auth pages: also knows the auth-only messages. */
export function AuthT({ k, en, ne }) {
  const entry = k ? (authMessages[k] ?? allPublicMessages[k]) : { en, ne }
  if (!entry) return k
  return <Bilingual entry={entry} />
}
