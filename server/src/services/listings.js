import { db } from '../config/db.js'
import { QUEUE, enqueue } from '../jobs/queues.js'
import { uniqueSlug } from '../lib/slug.js'
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
  'seoTitle',
  'seoDescription',
]

const pick = (input, keys) =>
  Object.fromEntries(keys.filter((k) => input[k] !== undefined).map((k) => [k, input[k]]))

export const listingSlugTaken = (client, exceptId) => async (slug) =>
  Boolean(
    await client.business.findFirst({
      where: { slug, ...(exceptId && { id: { not: exceptId } }) },
    }),
  )

async function writeRelations(tx, businessId, { categoryIds, tagIds, location }) {
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

/** Creates a listing with its categories, tags and map pin. Run inside a transaction. */
export async function createListing(tx, input) {
  const slug = input.slug ?? (await uniqueSlug(input.name, listingSlugTaken(tx), 'listing'))
  const listing = await tx.business.create({
    data: { ...pick(input, LISTING_SCALARS), slug, ownerId: input.ownerId ?? null },
  })
  await writeRelations(tx, listing.id, input)
  return listing
}

/** Applies a partial update; relations are replaced only when given. Run in a transaction. */
export async function updateListing(tx, id, input) {
  const data = pick(input, [...LISTING_SCALARS, 'slug'])
  const listing = Object.keys(data).length
    ? await tx.business.update({ where: { id }, data })
    : await tx.business.findUniqueOrThrow({ where: { id } })
  await writeRelations(tx, id, input)
  return listing
}

/**
 * After a listing changes: purge its cached API responses, revalidate its pages (both id and
 * slug tags, the old slug too) and refresh search text and category counts.
 */
export async function afterListingChange({ id, slug, oldSlug }, categoryIds = []) {
  const categories = categoryIds.length
    ? await db.category.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, slug: true },
      })
    : []
  await Promise.all([
    queueContentChange({
      cacheTags: [`listing:${id}`, ...categories.map((c) => `category:${c.id}`), 'home', 'search'],
      pageTags: pageTagsFor({
        listings: [{ id, slug, oldSlug: oldSlug !== slug ? oldSlug : undefined }],
        categories,
        extra: ['home'],
      }),
    }),
    enqueue(QUEUE.DIRECTORY, 'sync-listings', { businessIds: [id] }),
    enqueue(QUEUE.DIRECTORY, 'refresh-counts', {}),
  ])
}

/** Category ids a listing currently belongs to. */
export async function categoryIdsOf(client, businessId) {
  const rows = await client.businessCategory.findMany({
    where: { businessId },
    select: { categoryId: true },
  })
  return rows.map((r) => r.categoryId)
}
