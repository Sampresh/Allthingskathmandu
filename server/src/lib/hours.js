import { Prisma } from '../generated/prisma/client'

// Weekly hours JSON: { mon: [["09:00","18:00"]], ..., sun: [] }. A slot whose close is earlier
// than its open runs past midnight ("18:00"-"02:00"); "24:00" closes at midnight.
export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat']

// Nepal Time is UTC+05:45 all year (no daylight saving).
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000

const pad = (n) => String(n).padStart(2, '0')

/** Current weekday, previous weekday, HH:MM and YYYY-MM-DD in Nepal Time. */
export function nepalClock(at = new Date()) {
  const t = new Date(at.getTime() + NEPAL_OFFSET_MS)
  const index = t.getUTCDay()
  return {
    day: DAYS[index],
    yesterday: DAYS[(index + 6) % 7],
    time: `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`,
    date: t.toISOString().slice(0, 10),
  }
}

const slots = (hours, day) => (Array.isArray(hours?.[day]) ? hours[day] : [])

/** true / false, or null when the listing has no hours. */
export function isOpenAt(hours, clock = nepalClock()) {
  if (!hours || typeof hours !== 'object') return null
  const { day, yesterday, time } = clock
  const today = slots(hours, day).some(([open, close]) =>
    close > open ? open <= time && time < close : open <= time,
  )
  const lateFromYesterday = slots(hours, yesterday).some(
    ([open, close]) => close < open && time < close,
  )
  return today || lateFromYesterday
}

/** SQL condition: listing `b` is open now (same rules as isOpenAt). */
export function openNowSql(clock = nepalClock()) {
  const { day, yesterday, time } = clock
  const daySlots = (d) => Prisma.sql`jsonb_array_elements(
    CASE WHEN jsonb_typeof(b.hours -> ${d}::text) = 'array' THEN b.hours -> ${d}::text ELSE '[]'::jsonb END)`
  return Prisma.sql`(
    EXISTS (SELECT 1 FROM ${daySlots(day)} s
      WHERE CASE WHEN (s->>1) > (s->>0)
        THEN (s->>0) <= ${time}::text AND ${time}::text < (s->>1)
        ELSE (s->>0) <= ${time}::text END)
    OR EXISTS (SELECT 1 FROM ${daySlots(yesterday)} s
      WHERE (s->>1) < (s->>0) AND ${time}::text < (s->>1))
  )`
}
