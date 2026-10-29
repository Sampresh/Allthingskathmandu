// Mirrors server/src/lib/hours.js so cached pages can show a current "Open now".
export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']
export const WEEK = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']

const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000
const pad = (n) => String(n).padStart(2, '0')

export function nepalClock(at = new Date()) {
  const t = new Date(at.getTime() + NEPAL_OFFSET_MS)
  const index = t.getUTCDay()
  return {
    day: DAYS[index],
    yesterday: DAYS[(index + 6) % 7],
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
  }
}

const slots = (hours, day) => (Array.isArray(hours?.[day]) ? hours[day] : [])

export function isOpenAt(hours, clock = nepalClock()) {
  if (!hours || typeof hours !== 'object') return null
  const { day, yesterday, time } = clock
  const today = slots(hours, day).some(([open, close]) =>
    close > open ? open <= time && time < close : open <= time,
  )
  const late = slots(hours, yesterday).some(([open, close]) => close < open && time < close)
  return today || late
}

const isAllDay = ([open, close]) => open === '00:00' && close === '24:00'

/**
 * Open or closed now, and the next change, in Nepal time (UTC+05:45):
 *   { open: true, closes: 'HH:MM' }   closes may be after midnight ('01:00') or '24:00'
 *   { open: true, closes: null }      open around the clock every day
 *   { open: false, opens: 'HH:MM', inDays: 0..6 }  0 = later today, 1 = tomorrow
 *   { open: false }                   no opening times at all
 * null when the listing has no hours. Overnight slots belong to the day they open.
 */
export function openState(hours, clock = nepalClock()) {
  if (!hours || typeof hours !== 'object') return null
  const { day, yesterday, time } = clock
  const index = DAYS.indexOf(day)

  const late = slots(hours, yesterday).find(([open, close]) => close < open && time < close)
  if (late) return { open: true, closes: late[1] }
  const current = slots(hours, day).find(([open, close]) =>
    close > open ? open <= time && time < close : open <= time,
  )
  if (current) {
    if (DAYS.every((d) => slots(hours, d).some(isAllDay))) return { open: true, closes: null }
    // A day that runs to midnight continues into a next day that opens at 00:00.
    if (current[1] === '24:00') {
      const next = slots(hours, DAYS[(index + 1) % 7]).find(([open]) => open === '00:00')
      if (next) return { open: true, closes: next[1] }
    }
    return { open: true, closes: current[1] }
  }
  for (let i = 0; i < 7; i += 1) {
    const opens = slots(hours, DAYS[(index + i) % 7])
      .map(([open]) => open)
      .filter((open) => i > 0 || open > time)
      .sort()[0]
    if (opens) return { open: false, opens, inDays: i }
  }
  return { open: false }
}

export const daySlots = slots
