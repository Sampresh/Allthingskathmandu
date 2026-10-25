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

export const daySlots = slots
