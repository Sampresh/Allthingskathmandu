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

// ---------- Parsing the LISTINGS.md text format ----------

const DAY_NAMES = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/
// An overnight slot closing later than this is unusual enough to ask staff to check.
const LATE_CLOSE = '06:00'

const ALL_DAY = ['00:00', '24:00']
const emptyWeek = () => Object.fromEntries(DAYS.map((d) => [d, []]))

/** "Mon" or "Mon-Fri" (wrapping, so "Sun-Fri" and "Thu-Sun" work) → day keys. */
function parseDayRange(text) {
  const [from, to, extra] = text.toLowerCase().split('-')
  if (extra !== undefined || !(from in DAY_NAMES) || (to !== undefined && !(to in DAY_NAMES)))
    return null
  const start = DAY_NAMES[from]
  const end = to === undefined ? start : DAY_NAMES[to]
  const days = []
  for (let i = start; ; i = (i + 1) % 7) {
    days.push(DAYS[i])
    if (i === end) break
  }
  return days
}

/** "09:00-18:00" | "24h" | "closed" → [] or [[open, close]]; null when unreadable. */
function parseRange(text) {
  const value = text.toLowerCase()
  if (value === 'closed') return []
  if (value === '24h') return [ALL_DAY]
  const [open, close, extra] = value.split('-')
  if (extra !== undefined || !TIME.test(open ?? '') || !TIME.test(close ?? '')) return null
  // Closing at 00:00 means midnight at the end of the opening day.
  const end = close === '00:00' ? '24:00' : close
  if (open === end) return null
  return [[open, end]]
}

/**
 * Parses the hours text used in listings.csv (docs/LISTINGS.md):
 *   "09:00-18:00" every day · "24h" · "Mon-Fri 09:00-18:00; Sat closed" ·
 *   "Mon-Thu, Sun 08:00-22:00; Fri 08:00-23:00" · overnight "16:00-02:00" (belongs to the
 *   opening day). Days a per-day value does not mention are closed.
 * Returns { hours, warnings } with hours null for an empty value, or { hours: null, error }
 * when the text cannot be read.
 */
export function parseHoursText(raw) {
  const text = String(raw ?? '')
    .trim()
    .replace(/\s+/g, ' ')
  if (!text) return { hours: null, warnings: [] }

  const fail = () => ({ hours: null, error: `Could not read hours "${text}"` })
  const hours = emptyWeek()
  const simple = parseRange(text)
  if (simple) {
    for (const day of DAYS) hours[day] = simple.map((s) => [...s])
  } else {
    for (const segment of text.split(';').map((s) => s.trim())) {
      // "<days> <range>": days may be a comma list ("Mon-Thu, Sun"); the range is the last word.
      const match = segment.match(/^(.+?)\s+(\S+)$/)
      if (!match) return fail()
      const range = parseRange(match[2])
      if (!range) return fail()
      for (const part of match[1].split(',').map((s) => s.trim())) {
        const days = parseDayRange(part)
        if (!days) return fail()
        for (const day of days) hours[day].push(...range.map((s) => [...s]))
      }
    }
  }

  const warnings = []
  const late = new Set()
  for (const day of DAYS) {
    for (const [open, close] of hours[day]) {
      if (close < open && close > LATE_CLOSE) late.add(`${open}-${close}`)
    }
  }
  for (const slot of late) warnings.push(`Overnight hours ${slot} close after ${LATE_CLOSE}; check`)
  return { hours, warnings }
}
