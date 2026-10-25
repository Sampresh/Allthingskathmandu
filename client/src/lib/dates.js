// Kathmandu dates and times for events and the market (Part 4 §10: 12-hour Nepal time).

const NEPALI_DIGITS = '०१२३४५६७८९'
export const toNepaliDigits = (value) => String(value).replace(/\d/g, (d) => NEPALI_DIGITS[d])

/** "Thu, 5 Nov 2026" in Kathmandu. */
export const formatDay = (iso) =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kathmandu',
  }).format(new Date(iso))

/** "6:00 PM" in Kathmandu. */
export const formatClock = (iso) =>
  new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kathmandu',
  }).format(new Date(iso))

/** Kathmandu calendar date "2026-11-05", for grouping events by day. */
export const nepalDateKey = (iso) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date(iso))

/** Whole days since `iso` (0 = today), for "posted 3 days ago". */
export const daysAgo = (iso, now = Date.now()) =>
  Math.max(0, Math.floor((now - new Date(iso).getTime()) / (24 * 60 * 60 * 1000)))

/** <input type="datetime-local"> value ↔ ISO, always in Kathmandu time (UTC+5:45). */
const NEPAL_OFFSET_MS = (5 * 60 + 45) * 60 * 1000
export const nepalInputToIso = (value) => (value ? `${value}:00+05:45` : null)
export const isoToNepalInput = (iso) =>
  iso ? new Date(new Date(iso).getTime() + NEPAL_OFFSET_MS).toISOString().slice(0, 16) : ''
