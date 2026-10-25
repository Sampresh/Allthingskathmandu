import { describe, it, expect } from 'vitest'
import { isOpenAt, nepalClock } from '../src/lib/hours.js'

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
