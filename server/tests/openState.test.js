import { describe, it, expect } from 'vitest'
import * as client from '../../client/src/lib/hours.js'
import * as server from '../src/lib/hours.js'
import { parseHoursText } from '../src/lib/hours.js'

// Hours from prisma/data/listings.csv.
const jasper = parseHoursText('10:00-01:00').hours // Jasper Restaurant
const titos = parseHoursText('Mon-Thu 16:00-02:00; Fri-Sat 16:00-03:00; Sun 16:00-02:00').hours
const courier = parseHoursText(
  'Mon-Tue 10:00-18:00; Wed 09:30-18:00; Thu-Fri 10:00-18:00; Sat closed; Sun 10:00-18:00',
).hours
const allDay = parseHoursText('24h').hours
const avalon = parseHoursText(
  'Mon 06:00-00:00; Tue-Wed 24h; Thu 06:30-22:00; Fri 00:30-22:00; Sat 24h; Sun 06:30-22:00',
).hours

const PREV = { sun: 'sat', mon: 'sun', tue: 'mon', wed: 'tue', thu: 'wed', fri: 'thu', sat: 'fri' }
const at = (day, time) => ({ day, yesterday: PREV[day], time })

describe.each([
  ['server', server],
  ['client', client],
])('openState (%s)', (_, { openState, nepalClock }) => {
  it('gives the closing time while open, including after midnight', () => {
    expect(openState(jasper, at('mon', '12:00'))).toEqual({ open: true, closes: '01:00' })
    expect(openState(jasper, at('tue', '00:30'))).toEqual({ open: true, closes: '01:00' })
    expect(openState(titos, at('sat', '02:30'))).toEqual({ open: true, closes: '03:00' })
    expect(openState(titos, at('mon', '02:30'))).toEqual({ open: false, opens: '16:00', inDays: 0 })
  })

  it('gives the next opening while closed: later today, tomorrow or a later day', () => {
    expect(openState(courier, at('wed', '08:00'))).toEqual({
      open: false,
      opens: '09:30',
      inDays: 0,
    })
    expect(openState(courier, at('fri', '19:00'))).toEqual({
      open: false,
      opens: '10:00',
      inDays: 2,
    })
    expect(openState(courier, at('sat', '12:00'))).toEqual({
      open: false,
      opens: '10:00',
      inDays: 1,
    })
  })

  it('handles open around the clock and days that run into the next', () => {
    expect(openState(allDay, at('thu', '03:00'))).toEqual({ open: true, closes: null })
    // Monday to midnight, then Tuesday 24h: closes at the end of Tuesday.
    expect(openState(avalon, at('mon', '23:00'))).toEqual({ open: true, closes: '24:00' })
    expect(openState(avalon, at('fri', '00:10'))).toEqual({
      open: false,
      opens: '00:30',
      inDays: 0,
    })
  })

  it('is null without hours and closed for good when no day opens', () => {
    expect(openState(null, at('mon', '10:00'))).toBeNull()
    expect(openState(parseHoursText('Sat-Fri closed').hours, at('mon', '10:00'))).toEqual({
      open: false,
    })
  })

  it('uses Nepal time (UTC+05:45)', () => {
    // 2026-10-30 19:00 UTC is Saturday 00:45 in Kathmandu: Jasper is still open from Friday.
    const clock = nepalClock(new Date('2026-10-30T19:00:00Z'))
    expect(clock).toMatchObject({ day: 'sat', yesterday: 'fri', time: '00:45' })
    expect(openState(jasper, clock)).toEqual({ open: true, closes: '01:00' })
    expect(openState(courier, nepalClock(new Date('2026-10-30T04:10:00Z')))).toEqual({
      open: false,
      opens: '10:00',
      inDays: 0,
    })
  })
})
