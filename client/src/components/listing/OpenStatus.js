'use client'

import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Bilingual } from '@/components/common/Bilingual'
import { formatTime12 } from '@/lib/format'

const NPT_MS = (5 * 60 + 45) * 60 * 1000

/** "Open now · closes 10:00 PM", "Closed · opens tomorrow 9:00 AM", … in both languages. */
function describe(state) {
  if (state.open) {
    if (!state.closes) return { en: 'Open 24 hours', ne: '२४ घण्टा खुला' }
    const t = formatTime12(state.closes)
    return { en: `Open now · closes ${t}`, ne: `अहिले खुला · ${t} मा बन्द` }
  }
  if (!state.opens) return { en: 'Closed', ne: 'बन्द' }
  const t = formatTime12(state.opens)
  if (state.inDays === 0) return { en: `Closed · opens ${t}`, ne: `बन्द · ${t} मा खुल्छ` }
  if (state.inDays === 1)
    return { en: `Closed · opens tomorrow ${t}`, ne: `बन्द · भोलि ${t} मा खुल्छ` }
  // Noon on that day in Nepal, named in each language by the browser.
  const day = new Date(Date.now() + state.inDays * 86_400_000 + NPT_MS)
  day.setUTCHours(12)
  const name = (locale) =>
    new Intl.DateTimeFormat(locale, { weekday: 'long', timeZone: 'UTC' }).format(day)
  return { en: `Closed · opens ${name('en')} ${t}`, ne: `बन्द · ${name('ne')} ${t} मा खुल्छ` }
}

/**
 * Open or closed and the next change, in Nepal time. Renders the API's value first (so cached
 * HTML hydrates cleanly), then loads the hours logic after the page is up and recomputes every
 * minute, since a cached page may be an hour old. Lazy so results pages stay within budget.
 * Renders nothing when the listing has no hours.
 */
export function OpenStatus({ hours, initial = null, className }) {
  const [state, setState] = useState(initial)

  useEffect(() => {
    if (!hours) return
    let timer
    let active = true
    import('@/lib/hours').then(({ openState }) => {
      if (!active) return
      const tick = () => setState(openState(hours))
      tick()
      timer = setInterval(tick, 60_000)
    })
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [hours])

  if (!state) return null
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 text-sm',
        state.open ? 'font-semibold text-success' : 'text-text-muted',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={clsx('size-2 rounded-pill', state.open ? 'bg-success' : 'bg-text-muted/50')}
      />
      <Bilingual entry={describe(state)} />
    </span>
  )
}
