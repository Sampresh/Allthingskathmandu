/**
 * Imports listings from a CSV in the docs/LISTINGS.md format (same service as
 * POST /admin/listings/import).
 *
 *   npm run import:listings -- prisma/data/listings.csv --dry-run
 *   npm run import:listings -- prisma/data/listings.csv [--out result.csv]
 *
 * --dry-run prints what would happen and writes nothing. A real run syncs the taxonomy, writes
 * rows in file order and queues search sync, counts, cache purge and page revalidation (the
 * worker carries those out). --out saves the row-level report as CSV.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { db } from '../src/config/db.js'
import { redis } from '../src/config/redis.js'
import { closeQueues } from '../src/jobs/queues.js'
import { planImport, resultCsv, runImport } from '../src/services/listingImport.js'

const args = process.argv.slice(2)
const file = args.find((a) => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--out')
const dryRun = args.includes('--dry-run')
const outIndex = args.indexOf('--out')
const out = outIndex === -1 ? null : args[outIndex + 1]

if (!file || (outIndex !== -1 && !out)) {
  console.error('Usage: npm run import:listings -- <file.csv> [--dry-run] [--out result.csv]')
  process.exit(1)
}

function report({ counts, rows }) {
  console.log(
    `${counts.total} rows: ${counts.create} create, ${counts.update} update, ` +
      `${counts.skip} skip, ${counts.error} error`,
  )
  console.log(`${counts.needsArea} need an area, ${counts.hoursToReview} have hours to review`)
  for (const row of rows.filter((r) => r.action === 'error')) {
    console.log(`  error  line ${row.line} ${row.name}: ${row.messages.join('; ')}`)
  }
  for (const row of rows.filter((r) => r.flags.some((f) => f !== 'needs area'))) {
    const flags = row.flags.filter((f) => f !== 'needs area')
    console.log(`  check  line ${row.line} ${row.name}: ${flags.join('; ')}`)
  }
}

async function main() {
  const csv = readFileSync(file, 'utf8')
  let result
  if (dryRun) {
    console.log(`Dry run of ${file} (nothing is written)`)
    result = await planImport(csv)
  } else {
    console.log(`Importing ${file}`)
    result = await runImport({
      csv,
      onProgress: ({ done, total }) => process.stdout.write(`\r  ${done}/${total} rows`),
    })
    process.stdout.write('\n')
  }
  report(result)
  if (out) {
    writeFileSync(out, resultCsv(result.rows))
    console.log(`Report saved to ${out}`)
  }
  if (result.counts.error) process.exitCode = 2
}

main()
  .catch((err) => {
    console.error(`Import failed: ${err.message}`)
    process.exitCode = 1
  })
  .finally(async () => {
    await closeQueues()
    await db.$disconnect()
    redis.disconnect()
  })
