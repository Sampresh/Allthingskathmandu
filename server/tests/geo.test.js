import { describe, it, expect, beforeEach } from 'vitest'
import { db } from '../src/config/db.js'
import { nearbyListings, setBusinessLocation } from '../src/services/geo.js'
import { resetDb, createListing } from './helpers/db.js'

// Thamel Chowk
const origin = { lat: 27.7154, lng: 85.3123 }

async function listingAt(point, data) {
  const listing = await createListing(data)
  await setBusinessLocation(db, listing.id, point)
  return listing
}

describe('nearbyListings', () => {
  beforeEach(resetDb)

  it('orders LIVE listings by distance and excludes far, draft and deleted ones', async () => {
    // Created far-first so ordering cannot come from insertion order.
    const lazimpat = await listingAt({ lat: 27.723, lng: 85.321 }, { name: 'Lazimpat cafe' }) // ~1.2 km
    const thamel = await listingAt({ lat: 27.7158, lng: 85.3127 }, { name: 'Thamel cafe' }) // ~60 m
    await listingAt({ lat: 27.672, lng: 85.428 }, { name: 'Bhaktapur cafe' }) // ~12.4 km
    await listingAt({ lat: 27.7155, lng: 85.3124 }, { name: 'Draft cafe', status: 'DRAFT' })
    await listingAt({ lat: 27.7156, lng: 85.3125 }, { name: 'Deleted cafe', deletedAt: new Date() })

    const rows = await nearbyListings({ ...origin, radiusMeters: 5000, limit: 10 })

    expect(rows.map((r) => r.id)).toEqual([thamel.id, lazimpat.id])
    expect(rows[0].meters).toBeLessThan(100)
    expect(rows[1].meters).toBeGreaterThan(1000)
    expect(rows[1].meters).toBeLessThan(1500)
  })

  it('respects the limit', async () => {
    await listingAt({ lat: 27.7158, lng: 85.3127 })
    await listingAt({ lat: 27.716, lng: 85.313 })
    const rows = await nearbyListings({ ...origin, radiusMeters: 5000, limit: 1 })
    expect(rows).toHaveLength(1)
  })
})

describe('search trigger', () => {
  beforeEach(resetDb)

  it('fills searchVector from name and short description on insert and update', async () => {
    const listing = await createListing({ name: 'Momo House', shortDesc: 'Steamed dumplings' })
    const match = (term) => db.$queryRaw`
      SELECT id FROM businesses
      WHERE id = ${listing.id}::uuid AND "searchVector" @@ plainto_tsquery('simple', ${term})`

    expect(await match('momo')).toHaveLength(1)
    expect(await match('dumplings')).toHaveLength(1)

    await db.business.update({ where: { id: listing.id }, data: { shortDesc: 'Noodles' } })
    expect(await match('dumplings')).toHaveLength(0)
    expect(await match('noodles')).toHaveLength(1)
  })
})
