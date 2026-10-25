import { accountMessages } from '@/lib/messages/account'
import { clientMessages } from '@/lib/messages/client'
import { marketMessages } from '@/lib/messages/market'
import { Bilingual } from './Bilingual'

/** T for the member area and the review form: also knows the account-only messages. */
export function AccountT({ k, en, ne }) {
  const entry = k ? (accountMessages[k] ?? marketMessages[k] ?? clientMessages[k]) : { en, ne }
  if (!entry) return k
  return <Bilingual entry={entry} />
}
