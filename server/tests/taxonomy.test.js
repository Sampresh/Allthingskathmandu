import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { AREAS } from '../prisma/data/areas.js'
import { GROUPS } from '../prisma/data/taxonomy.js'
import { matchArea } from '../src/lib/areaMatch.js'

// "- Eat & Drink: Restaurants (9), Cafes (7), ..." lines under "## Taxonomy" in LISTINGS.md.
function listingsMdTaxonomy() {
  const md = readFileSync('../docs/LISTINGS.md', 'utf8')
  const section = md.split('## Taxonomy')[1].split('\n## ')[0]
  return section
    .split('\n')
    .filter((line) => line.startsWith('- '))
    .map((line) => {
      const [group, rest] = line.slice(2).split(/:\s(.+)/)
      const categories = rest.split(/,\s(?![^(]*\))/).map((c) => {
        const [, name, count] = c.trim().match(/^(.+?) \((\d+)\)$/)
        return { name, count: Number(count) }
      })
      return { group, categories }
    })
}

describe('taxonomy data', () => {
  it('matches the Taxonomy section of docs/LISTINGS.md, in order', () => {
    const doc = listingsMdTaxonomy()
    expect(GROUPS.map((g) => g.nameEn)).toEqual(doc.map((g) => g.group))
    for (const [i, group] of GROUPS.entries()) {
      expect(group.categories.map(([name]) => name)).toEqual(doc[i].categories.map((c) => c.name))
    }
  })

  it('agrees with the row counts in listings.csv', () => {
    const rows = parse(readFileSync('prisma/data/listings.csv', 'utf8'), { columns: true })
    const counts = {}
    for (const row of rows) counts[row.category] = (counts[row.category] ?? 0) + 1
    const expected = Object.fromEntries(
      listingsMdTaxonomy().flatMap((g) => g.categories.map((c) => [c.name, c.count])),
    )
    expect(counts).toEqual(expected)
  })
})

describe('matchArea', () => {
  const areas = AREAS.map((a) => ({ ...a, id: a.slug }))
  const area = (address) => matchArea(address, areas)?.slug ?? null

  it('matches area names and aliases on whole words', () => {
    expect(area('Amrit Marg, Thamel')).toBe('thamel')
    expect(area('16 Paknajol Marg, Kathmandu')).toBe('thamel')
    expect(area('Boudhanath Sadak, Kathmandu')).toBe('boudha')
    expect(area('Lagankhel, Lalitpur')).toBe('patan')
    expect(area('Durbar Square, Bhaktapur')).toBe('bhaktapur')
  })

  it('prefers the place named first and leaves bare cities unmatched', () => {
    expect(area('Kwabahal, inside Hotel Nepalaya, Thamel')).toBe('thamel')
    expect(area('Kathmandu')).toBeNull()
    expect(area('Lalitpur')).toBeNull()
    // A name inside a longer word is not a match.
    expect(area('Thamelpur Road')).toBeNull()
  })
})
