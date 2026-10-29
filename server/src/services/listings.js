import { db } from '../config/db.js'
import { ApiError } from '../utils/ApiError.js'
import { QUEUE, enqueue } from '../jobs/queues.js'
import { uniqueSlug } from '../lib/slug.js'
import { profileScore } from '../validators/listing.schema.js'
import { setBusinessLocation } from './geo.js'
import { pageTagsFor, queueContentChange } from './revalidate.js'

// Scalar columns Admin (and later owners) may write directly.
export const LISTING_SCALARS = [
  'name',
  'nameNe',
  'type',
  'shortDesc',
  'description',
  'logoUrl',
  'logoPublicId',
  'phone',
  'whatsapp',
  'email',
  'website',
  'playStoreUrl',
  'appStoreUrl',
  'address',
  'areaId',
  'hours',
  'priceLevel',
  'status',
  'isVerified',
  'verification',
  'featuredUntil',
  'seoTitle',
  'seoDescription',
  'googlePlaceId',
  'adminNote',
]

const pick = (input, keys) =>
  Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]))

export const listingSlugTaken = (client, exceptId) => async (slug) =>
  Boolean(
    await client.business.findFirst({
      where: { slug, ...(exceptId && { id: { not: exceptId } }) },
    }),
  )

// Listings sit in directory categories (not groups or market categories) and existing tags.
async function assertRelations(tx, { categoryIds, tagIds }) {
  if (categoryIds) {
    const count = await tx.category.count({
      where: { id: { in: categoryIds }, kind: 'DIRECTORY', parentId: { not: null } },
    })
    if (count !== new Set(categoryIds).size)
      throw ApiError.validation([{ path: 'categoryIds', message: 'Pick categories, not groups' }])
  }
  if (tagIds?.length) {
    const count = await tx.tag.count({ where: { id: { in: tagIds } } })
    if (count !== new Set(tagIds).size)
      throw ApiError.validation([{ path: 'tagIds', message: 'Unknown tag' }])
  }
}

async function writeRelations(tx, businessId, { categoryIds, tagIds, location }) {
  await assertRelations(tx, { categoryIds, tagIds })
  if (categoryIds) {
    await tx.businessCategory.deleteMany({ where: { businessId } })
    // The first category is the primary one.
    await tx.businessCategory.createMany({
      data: categoryIds.map((categoryId, i) => ({ businessId, categoryId, isPrimary: i === 0 })),
    })
  }
  if (tagIds) {
    await tx.businessTag.deleteMany({ where: { businessId } })
    if (tagIds.length)
      await tx.businessTag.createMany({ data: tagIds.map((tagId) => ({ businessId, tagId })) })
  }
  if (location !== undefined) {
    if (location) await setBusinessLocation(tx, businessId, location)
    else await tx.$executeRaw`UPDATE businesses SET location = NULL WHERE id = ${businessId}::uuid`
  }
}

/**
 * Recomputes profileScore (how complete the listing is, used in ranking) from the saved row.
 * Run in the same transaction as the change. Returns the listing as saved.
 */
export async function refreshProfileScore(tx, id) {
  const row = await tx.business.findUniqueOrThrow({
    where: { id },
    include: { categories: { select: { categoryId: true } } },
  })
  const [{ pinned }] = await tx.$queryRaw`
    SELECT location IS NOT NULL AS pinned FROM businesses WHERE id = ${id}::uuid`
  const { categories, ...listing } = row
  const score = profileScore({
    ...listing,
    categoryIds: categories.map((c) => c.categoryId),
    location: pinned,
  })
  if (score === listing.profileScore) return listing
  return tx.business.update({ where: { id }, data: { profileScore: score } })
}

/** Creates a listing with its categories, tags and map pin. Run inside a transaction. */
export async function createListing(tx, input) {
  const slug = input.slug ?? (await uniqueSlug(input.name, listingSlugTaken(tx), 'listing'))
  const listing = await tx.business.create({
    data: {
      ...pick(input, LISTING_SCALARS),
      shortDesc: input.shortDesc ?? '',
      slug,
      ownerId: input.ownerId ?? null,
    },
  })
  await writeRelations(tx, listing.id, input)
  return refreshProfileScore(tx, listing.id)
}

/** Applies a partial update; relations are replaced only when given. Run in a transaction. */
export async function updateListing(tx, id, input) {
  const data = pick(input, [...LISTING_SCALARS, 'slug'])
  if (Object.keys(data).length) await tx.business.update({ where: { id }, data })
  await writeRelations(tx, id, input)
  return refreshProfileScore(tx, id)
}

/**
 * After listings change: purge their cached API responses, revalidate their pages (both id
 * and slug tags, old slugs too) and refresh search text, profile scores and category counts.
 * listings: [{ id, slug, oldSlug? }].
 */
export async function afterListingsChange(listings, categoryIds = []) {
  if (!listings.length) return
  const categories = categoryIds.length
    ? await db.category.findMany({
        where: { id: { in: [...new Set(categoryIds)] } },
        select: { id: true, slug: true },
      })
    : []
  await Promise.all([
    queueContentChange({
      cacheTags: [
        ...listings.map((l) => `listing:${l.id}`),
        ...categories.map((c) => `category:${c.id}`),
        'home',
        'search',
        'emergency',
      ],
      pageTags: pageTagsFor({
        listings: listings.map(({ id, slug, oldSlug }) => ({
          id,
          slug,
          oldSlug: oldSlug !== slug ? oldSlug : undefined,
        })),
        categories,
        extra: ['home', 'emergency'],
      }),
    }),
    enqueue(QUEUE.DIRECTORY, 'sync-listings', { businessIds: listings.map((l) => l.id) }),
    enqueue(QUEUE.DIRECTORY, 'refresh-counts', {}),
  ])
}

/** afterListingsChange for one listing. */
export const afterListingChange = (listing, categoryIds = []) =>
  afterListingsChange([listing], categoryIds)

/** Category ids a listing currently belongs to. */
export async function categoryIdsOf(client, businessId) {
  const rows = await client.businessCategory.findMany({
    where: { businessId },
    select: { categoryId: true },
  })
  return rows.map((r) => r.categoryId)
}
