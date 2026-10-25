import { readDb } from '../config/db.js'
import { Prisma } from '../generated/prisma/client'
import { MIN_LIVE_LISTINGS, areaSql, distanceSql, liveSql, slottedPage } from './directory.js'

const SYNONYM_TTL_MS = 5 * 60 * 1000
const MAX_VARIANTS = 8
// Fewer first-page results than this triggers a "did you mean".
const DID_YOU_MEAN_BELOW = 3

const WORD = /[\p{L}\p{M}\p{N}]+/gu
const normalise = (text) => (text.toLowerCase().match(WORD) ?? []).join(' ')

let synonyms = { loadedAt: 0, groups: [] }

// Admin-managed synonyms, cached in memory for a few minutes per process.
async function synonymGroups() {
  if (Date.now() - synonyms.loadedAt < SYNONYM_TTL_MS) return synonyms.groups
  const rows = await readDb.searchSynonym.findMany()
  synonyms = {
    loadedAt: Date.now(),
    groups: rows.map((r) => [...new Set([r.term, ...r.synonyms].map(normalise))].filter(Boolean)),
  }
  return synonyms.groups
}

export const resetSynonymCache = () => {
  synonyms = { loadedAt: 0, groups: [] }
}

const hasPhrase = (text, phrase) => ` ${text} `.includes(` ${phrase} `)
const replacePhrase = (text, phrase, alt) => ` ${text} `.replace(` ${phrase} `, ` ${alt} `).trim()

/**
 * The query plus its synonym variants, both ways: "dhara mistri thamel" also searches
 * "plumber thamel", and "plumber" also searches "dhara mistri".
 */
export async function expandQuery(q) {
  const base = normalise(q)
  const variants = new Set(base ? [base] : [])
  for (const group of await synonymGroups()) {
    for (const member of group) {
      if (!hasPhrase(base, member)) continue
      for (const alt of group) if (alt !== member) variants.add(replacePhrase(base, member, alt))
    }
  }
  return [...variants].slice(0, MAX_VARIANTS)
}

/** to_tsquery text: every word as a prefix, words ANDed, variants ORed. Only letters/digits. */
export function toTsQuery(variants) {
  return variants
    .map(
      (v) =>
        `(${v
          .split(' ')
          .map((w) => `${w}:*`)
          .join(' & ')})`,
    )
    .join(' | ')
}

function matchSql(q, tsQuery) {
  const fullText = tsQuery
    ? Prisma.sql`b."searchVector" @@ to_tsquery('simple', ${tsQuery})`
    : Prisma.sql`FALSE`
  // Trigram matching on the name covers typos and romanised spellings.
  return Prisma.sql`(${fullText} OR b.name % ${q} OR ${q} <% b.name)`
}

// Higher is better: text relevance, name similarity (an exact name wins), profile
// completeness, then closeness.
function scoreSql(q, tsQuery, point) {
  const rank = tsQuery
    ? Prisma.sql`ts_rank(b."searchVector", to_tsquery('simple', ${tsQuery}))`
    : Prisma.sql`0`
  const near = point
    ? Prisma.sql`COALESCE(1.0 / (1.0 + ${distanceSql(point)} / 1000.0), 0)`
    : Prisma.sql`0`
  return Prisma.sql`(
    ${rank} * 4
    + similarity(b.name, ${q}) * 2
    + word_similarity(${q}, b.name)
    + CASE WHEN lower(b.name) = lower(${q}) THEN 2 ELSE 0 END
    + b."profileScore" / 100.0 * 0.5
    + ${near})`
}

const escapeLike = (text) => text.replace(/[\\%_]/g, (c) => `\\${c}`)

async function matchingCategories(q, variants) {
  const patterns = variants.map((v) => `%${escapeLike(v)}%`)
  return readDb.$queryRaw`
    SELECT c.slug, c."nameEn", c."nameNe", g.slug AS "groupSlug", c."liveCount"
    FROM categories c
    JOIN categories g ON g.id = c."parentId"
    WHERE c.kind = 'DIRECTORY' AND c."isVisible" AND g."isVisible"
      AND c."liveCount" >= ${MIN_LIVE_LISTINGS}
      AND (c."nameEn" ILIKE ANY(${patterns}::text[]) OR c."nameNe" ILIKE ANY(${patterns}::text[])
           OR similarity(c."nameEn", ${q}) > 0.3)
    ORDER BY similarity(c."nameEn", ${q}) DESC, c."nameEn"
    LIMIT 5`
}

/** Closest known name to a query that found little: a category, listing or synonym term. */
async function didYouMean(q) {
  const [row] = await readDb.$queryRaw`
    SELECT name FROM (
      SELECT "nameEn" AS name FROM categories WHERE kind = 'DIRECTORY' AND "isVisible"
      UNION
      SELECT b.name FROM businesses b WHERE ${liveSql} AND b.name % ${q}
      UNION
      SELECT term FROM search_synonyms
    ) names
    WHERE similarity(name, ${q}) > 0.3 AND lower(name) <> lower(${q})
    ORDER BY similarity(name, ${q}) DESC
    LIMIT 1`
  return row?.name ?? null
}

/**
 * Search (Part 3 §4): full text + trigram + synonyms, optional area filter and distance
 * ranking, 20 per page with a cursor, at most two Featured cards per page.
 */
export async function search({ q, area, point, cursor, limit }) {
  const variants = await expandQuery(q)
  const tsQuery = variants.length ? toTsQuery(variants) : null

  const conditions = [liveSql, matchSql(q, tsQuery)]
  if (area) {
    const found = await readDb.area.findFirst({ where: { slug: area, isVisible: true } })
    conditions.push(found ? areaSql(found.id) : Prisma.sql`FALSE`)
  }

  const sortKey = Prisma.sql`-round(${scoreSql(q, tsQuery, point)}::numeric, 6)`
  const page = await slottedPage({
    point,
    where: Prisma.join(conditions, ' AND '),
    organicKey: sortKey,
    featuredKey: sortKey,
    cursor,
    limit,
  })

  if (cursor) return { ...page, categories: [], didYouMean: null }

  const [categories, suggestion] = await Promise.all([
    variants.length ? matchingCategories(q, variants) : [],
    page.items.length < DID_YOU_MEAN_BELOW ? didYouMean(q) : null,
  ])
  return { ...page, categories, didYouMean: suggestion }
}

/** Autocomplete: categories, listings and areas for what has been typed so far. */
export async function suggest(q) {
  const prefix = `${escapeLike(q)}%`
  const contains = `%${escapeLike(q)}%`

  const [categories, listings, areas] = await Promise.all([
    readDb.$queryRaw`
      SELECT c.slug, c."nameEn", c."nameNe", g.slug AS "groupSlug"
      FROM categories c
      JOIN categories g ON g.id = c."parentId"
      WHERE c.kind = 'DIRECTORY' AND c."isVisible" AND g."isVisible"
        AND c."liveCount" >= ${MIN_LIVE_LISTINGS}
        AND (c."nameEn" ILIKE ${contains} OR c."nameNe" ILIKE ${contains}
             OR similarity(c."nameEn", ${q}) > 0.3)
      ORDER BY (c."nameEn" ILIKE ${prefix}) DESC, similarity(c."nameEn", ${q}) DESC, c."nameEn"
      LIMIT 5`,
    readDb.$queryRaw`
      SELECT b.slug, b.name, b."nameNe", b.type
      FROM businesses b
      WHERE ${liveSql}
        AND (b.name ILIKE ${prefix} OR b."nameNe" ILIKE ${prefix} OR b.name % ${q} OR ${q} <% b.name)
      ORDER BY (b.name ILIKE ${prefix}) DESC, word_similarity(${q}, b.name) DESC,
               b."profileScore" DESC, b.name
      LIMIT 5`,
    readDb.$queryRaw`
      SELECT slug, "nameEn", "nameNe"
      FROM areas
      WHERE "isVisible" AND ("nameEn" ILIKE ${prefix} OR "nameNe" ILIKE ${prefix})
      ORDER BY "sortOrder", "nameEn"
      LIMIT 5`,
  ])
  return { categories, listings, areas }
}
