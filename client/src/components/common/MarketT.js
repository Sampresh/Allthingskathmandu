import { clientMessages } from '@/lib/messages/client'
import { marketMessages } from '@/lib/messages/market'
import { Bilingual } from './Bilingual'

/** T for the market and events pages: also knows their own messages. */
export function MarketT({ k, en, ne }) {
  const entry = k ? (marketMessages[k] ?? clientMessages[k]) : { en, ne }
  if (!entry) return k
  return <Bilingual entry={entry} />
}
