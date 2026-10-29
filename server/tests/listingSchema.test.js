import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  listingCreate,
  listingUpdate,
  profileScore,
  publishProblems,
} from '../src/validators/listing.schema.js'

const category = '019a0000-0000-7000-8000-000000000001'
const area = '019a0000-0000-7000-8000-000000000002'

describe('shared listing schema', () => {
  it('is identical in the API and the admin form', () => {
    expect(readFileSync('../client/src/lib/listingSchema.js', 'utf8')).toBe(
      readFileSync('src/validators/listing.schema.js', 'utf8'),
    )
  })

  it('allows short codes only for hotlines', () => {
    const base = { name: 'Police', categoryIds: [category], phone: '100' }
    expect(listingCreate.safeParse({ ...base, type: 'HOTLINE' }).success).toBe(true)
    const business = listingCreate.safeParse({ ...base, type: 'BUSINESS' })
    expect(business.error.issues[0].path).toEqual(['phone'])
    expect(listingUpdate.safeParse({ phone: '+9779800000000' }).success).toBe(true)
  })
})

describe('publishProblems', () => {
  const place = {
    type: 'BUSINESS',
    shortDesc: 'Newari food',
    categoryIds: [category],
    areaId: area,
    location: { lat: 27.7, lng: 85.3 },
    phone: '+97714000000',
    hours: { mon: [['09:00', '18:00']] },
    verification: { phone: true, hours: true },
  }
  const fields = (listing) => publishProblems(listing).map((p) => p.field)

  it('needs category, area, pin, description and verified phone and hours for places', () => {
    expect(fields(place)).toEqual([])
    expect(
      fields({ ...place, areaId: null, location: null, shortDesc: '', verification: {} }),
    ).toEqual(['areaId', 'location', 'shortDesc', 'verification.phone', 'verification.hours'])
    // Phone and hours are checked only where they exist.
    expect(fields({ ...place, phone: null, hours: null, verification: {} })).toEqual([])
  })

  it('needs description, logo and a link for apps, and a number for hotlines', () => {
    expect(fields({ type: 'APP', shortDesc: '' })).toEqual(['shortDesc', 'logoUrl', 'website'])
    expect(
      fields({
        type: 'APP',
        shortDesc: 'Rides',
        logoUrl: 'https://res.cloudinary.com/x/l.png',
        playStoreUrl: 'https://play.google.com/x',
      }),
    ).toEqual([])
    expect(fields({ type: 'HOTLINE' })).toEqual(['phone'])
    expect(fields({ type: 'HOTLINE', phone: '100' })).toEqual([])
  })
})

describe('profileScore', () => {
  it('is the share of fields that matter for the type', () => {
    expect(profileScore({ type: 'HOTLINE', categoryIds: [category], phone: '100' })).toBe(40)
    expect(
      profileScore({
        type: 'HOTLINE',
        categoryIds: [category],
        phone: '100',
        shortDesc: 'Police',
        description: 'Nepal Police emergency line',
        logoUrl: 'https://res.cloudinary.com/x/l.png',
      }),
    ).toBe(100)
    expect(profileScore({ type: 'BUSINESS' })).toBe(0)
  })
})
