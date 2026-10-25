import { clientMessages } from '@/lib/messages/client'
import { serverMessages } from '@/lib/messages/server'
import { Bilingual } from './Bilingual'

export const allPublicMessages = { ...clientMessages, ...serverMessages }

/** T for server components: also knows text only the server renders (never shipped as JS). */
export function ST({ k, en, ne }) {
  const entry = k ? allPublicMessages[k] : { en, ne }
  if (!entry) return k
  return <Bilingual entry={entry} />
}
