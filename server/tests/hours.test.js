import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { DAYS, isOpenAt, nepalClock, parseHoursText } from '../src/lib/hours.js'
import { hoursSchema } from '../src/validators/listing.schema.js'

const at = (day, time) => ({
  day,
  yesterday: { mon: 'sun', tue: 'mon', sat: 'fri' }[day],
  time,
  date: '2026-10-26',
})

describe('nepalClock', () => {
  it('uses UTC+05:45', () => {
    // 2026-10-25 18:20 UTC is Monday 2026-10-26 00:05 in Kathmandu.
    expect(nepalClock(new Date('2026-10-25T18:20:00Z'))).toEqual({
      day: 'mon',
      yesterday: 'sun',
      time: '00:05',
      date: '2026-10-26',
    })
  })
})

describe('isOpenAt', () => {
  const hours = {
    mon: [
      ['09:00', '13:00'],
      ['14:00', '18:00'],
    ],
    sat: [['18:00', '02:00']],
    sun: [],
  }

  it('handles split shifts', () => {
    expect(isOpenAt(hours, at('mon', '09:00'))).toBe(true)
    expect(isOpenAt(hours, at('mon', '13:30'))).toBe(false)
    expect(isOpenAt(hours, at('mon', '17:59'))).toBe(true)
    expect(isOpenAt(hours, at('mon', '18:00'))).toBe(false)
  })

  it('handles slots past midnight', () => {
    expect(isOpenAt(hours, at('sat', '23:00'))).toBe(true)
    expect(isOpenAt({ ...hours, sun: [] }, { day: 'sun', yesterday: 'sat', time: '01:30' })).toBe(
      true,
    )
    expect(isOpenAt({ ...hours, sun: [] }, { day: 'sun', yesterday: 'sat', time: '02:00' })).toBe(
      false,
    )
  })

  it('treats 24:00 as midnight and missing hours as unknown', () => {
    expect(isOpenAt({ tue: [['00:00', '24:00']] }, at('tue', '23:59'))).toBe(true)
    expect(isOpenAt(null, at('tue', '10:00'))).toBeNull()
    expect(isOpenAt({}, at('tue', '10:00'))).toBe(false)
  })
})

describe('parseHoursText (strings from prisma/data/listings.csv)', () => {
  const every = (slot) => Object.fromEntries(DAYS.map((d) => [d, [slot]]))

  it('reads a plain range as every day and 24h as all day', () => {
    expect(parseHoursText('07:30-22:30')).toEqual({
      hours: every(['07:30', '22:30']),
      warnings: [],
    })
    expect(parseHoursText('24h').hours).toEqual(every(['00:00', '24:00']))
  })

  it('keeps overnight ranges on the opening day and reads 00:00 as midnight', () => {
    expect(parseHoursText('10:00-01:00').hours.fri).toEqual([['10:00', '01:00']])
    expect(parseHoursText('09:00-00:00').hours.mon).toEqual([['09:00', '24:00']])
    const titos = parseHoursText('Mon-Thu 16:00-02:00; Fri-Sat 16:00-03:00; Sun 16:00-02:00')
    expect(titos.hours).toMatchObject({
      mon: [['16:00', '02:00']],
      fri: [['16:00', '03:00']],
      sat: [['16:00', '03:00']],
      sun: [['16:00', '02:00']],
    })
    // Open now at 01:30 on Saturday from Friday's slot.
    expect(isOpenAt(titos.hours, { day: 'sat', yesterday: 'fri', time: '01:30' })).toBe(true)
  })

  it('reads per-day values, closed days, comma lists and wrapping ranges', () => {
    expect(parseHoursText('Mon-Fri 09:00-18:00; Sat closed; Sun 09:00-18:00').hours).toMatchObject({
      mon: [['09:00', '18:00']],
      fri: [['09:00', '18:00']],
      sat: [],
      sun: [['09:00', '18:00']],
    })
    expect(
      parseHoursText('Mon-Thu, Sun 08:00-22:00; Fri 08:00-23:00; Sat 08:00-22:30').hours,
    ).toMatchObject({
      sun: [['08:00', '22:00']],
      thu: [['08:00', '22:00']],
      fri: [['08:00', '23:00']],
      sat: [['08:00', '22:30']],
    })
    expect(parseHoursText('Sun-Fri 09:00-19:30; Sat 11:30-18:30').hours).toMatchObject({
      sun: [['09:00', '19:30']],
      fri: [['09:00', '19:30']],
      sat: [['11:30', '18:30']],
    })
    expect(parseHoursText('Mon-Fri 24h; Sat closed; Sun 24h').hours.sat).toEqual([])
    expect(parseHoursText('Mon-Fri 09:00-19:00; Sat-Sun closed').hours.sun).toEqual([])
    expect(parseHoursText('Mon 06:00-00:00; Tue-Wed 24h; Thu 06:30-22:00').hours).toMatchObject({
      mon: [['06:00', '24:00']],
      tue: [['00:00', '24:00']],
      thu: [['06:30', '22:00']],
      fri: [],
    })
  })

  it('warns about overnight hours that close after 06:00', () => {
    const neo = parseHoursText('Mon 09:00-17:00; Tue-Sun 10:00-07:30')
    expect(neo.hours.tue).toEqual([['10:00', '07:30']])
    expect(neo.warnings).toEqual(['Overnight hours 10:00-07:30 close after 06:00; check'])
  })

  it('returns an error for text it cannot read, and null for empty', () => {
    expect(parseHoursText('OPD Mon-Fri 08:00-17:00; ER unconfirmed')).toEqual({
      hours: null,
      error: 'Could not read hours "OPD Mon-Fri 08:00-17:00; ER unconfirmed"',
    })
    expect(parseHoursText('Mon-Fri 9-5').error).toBeDefined()
    expect(parseHoursText('')).toEqual({ hours: null, warnings: [] })
  })

  it('reads every value in the data file except the one hospital note', () => {
    const rows = parse(readFileSync('prisma/data/listings.csv', 'utf8'), { columns: true })
    const failed = rows.filter((r) => parseHoursText(r.hours).error).map((r) => r.name)
    expect(failed).toEqual(['T.U. Teaching Hospital'])
    for (const row of rows) {
      const { hours } = parseHoursText(row.hours)
      if (hours) expect(hoursSchema.safeParse(hours).success).toBe(true)
    }
  })
})
