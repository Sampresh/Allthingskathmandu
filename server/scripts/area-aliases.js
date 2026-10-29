/**
 * Lists the place names found in a listings CSV's address column and the area each one maps
 * to (by area name or alias), so the alias list in prisma/data/areas.js can be curated.
 *
 *   npm run areas:aliases -- prisma/data/listings.csv
 *
 * Read-only: prints a report and changes nothing.
 */
import { readFileSync } from 'node:fs'
import { parse } from 'csv-parse/sync'
import { AREAS } from '../prisma/data/areas.js'
import { addressParts, matchArea } from '../src/lib/areaMatch.js'

const file = process.argv[2]
if (!file) {
  console.error('Usage: npm run areas:aliases -- <file.csv>')
  process.exit(1)
}

const rows = parse(readFileSync(file, 'utf8'), { columns: true, skip_empty_lines: true, bom: true })
const areas = AREAS.map(({ slug, nameEn, aliases }) => ({ id: slug, slug, nameEn, aliases }))

const matched = new Map()
const unmatched = new Map()
let withAddress = 0
for (const row of rows) {
  if (!row.address?.trim()) continue
  withAddress += 1
  const area = matchArea(row.address, areas)
  if (area) matched.set(area.slug, (matched.get(area.slug) ?? 0) + 1)
  else {
    for (const part of addressParts(row.address)) {
      unmatched.set(part, (unmatched.get(part) ?? 0) + 1)
    }
  }
}

const byCount = (map) => [...map.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
const total = [...matched.values()].reduce((sum, n) => sum + n, 0)
console.log(`${rows.length} rows, ${withAddress} with an address, ${total} matched to an area\n`)
console.log('Matched (area: rows)')
for (const [slug, count] of byCount(matched)) console.log(`  ${slug.padEnd(16)} ${count}`)
console.log('\nUnmatched address parts (part: rows); add real neighbourhood names as aliases')
for (const [part, count] of byCount(unmatched)) console.log(`  ${part.padEnd(40)} ${count}`)
