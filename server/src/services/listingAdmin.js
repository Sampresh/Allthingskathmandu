import { db } from '../config/db.js'
import { uniqueSlug } from '../lib/slug.js'
import { ApiError } from '../utils/ApiError.js'
import {
  PUBLISH_RULES_ENFORCED,
  VERIFICATION_ITEMS,
  publishProblems,
} from '../validators/listing.schema.js'
import { audit } from './audit.js'
import { afterListingsChange, listingSlugTaken, refreshProfileScore } from './listings.js'
import { assertPublishable, publishBlocked, ruleInputs } from './listingRules.js'
import { queueMediaDelete } from './media.js'

const DAY_MS = 24 * 60 * 60 * 1000
// Bulk "feature" without a date features for this long.
export const DEFAULT_FEATURE_DAYS = 30

/** A member whose listing goes LIVE becomes a business owner. Run in the status change's tx. */
export async function promoteOwner(tx, listing) {
  if (listing.status === 'LIVE' && listing.ownerId) {
    await tx.user.updateMany({
      where: { id: listing.ownerId, role: 'MEMBER' },
      data: { role: 'BUSINESS_OWNER' },
    })
  }
}

/** Changes status (LIVE only when the publish rules pass). Run in a transaction. */
export async function changeStatus(tx, req, before, status) {
  if (status === 'LIVE' && before.status !== 'LIVE') await assertPublishable(tx, before.id)
  const row = await tx.business.update({ where: { id: before.id }, data: { status } })
  await promoteOwner(tx, row)
  await audit(tx, req, {
    action: 'business.status',
    entity: 'business',
    entityId: before.id,
    diff: { status: { from: before.status, to: status } },
  })
  return row
}

/** Copy of a listing as a DRAFT: same details, categories and tags; no owner, media or place id. */
export async function duplicateListing(tx, req, id) {
  const source = await tx.business.findFirst({
    where: { id, deletedAt: null },
    include: { categories: true, tags: true },
  })
  if (!source) throw ApiError.notFound('Listing not found')
  const name = `${source.name} (copy)`.slice(0, 120)
  const slug = await uniqueSlug(name, listingSlugTaken(tx), 'listing')
  const copy = await tx.business.create({
    data: {
      name,
      slug,
      nameNe: source.nameNe,
      type: source.type,
      shortDesc: source.shortDesc,
      description: source.description,
      phone: source.phone,
      whatsapp: source.whatsapp,
      email: source.email,
      website: source.website,
      playStoreUrl: source.playStoreUrl,
      appStoreUrl: source.appStoreUrl,
      address: source.address,
      areaId: source.areaId,
      hours: source.hours ?? undefined,
      priceLevel: source.priceLevel,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      status: 'DRAFT',
      verification: Object.fromEntries(VERIFICATION_ITEMS.map((k) => [k, false])),
      categories: {
        create: source.categories.map(({ categoryId, isPrimary }) => ({ categoryId, isPrimary })),
      },
      tags: { create: source.tags.map(({ tagId }) => ({ tagId })) },
    },
  })
  await tx.$executeRaw`
    UPDATE businesses SET location = (SELECT location FROM businesses WHERE id = ${id}::uuid)
    WHERE id = ${copy.id}::uuid`
  await audit(tx, req, {
    action: 'business.duplicate',
    entity: 'business',
    entityId: copy.id,
    diff: { from: id },
  })
  return refreshProfileScore(tx, copy.id)
}

/**
 * Deletes a listing for good (SUPER_ADMIN, from Trash, name typed to confirm) and queues
 * its logo and photos for removal from Cloudinary. Listings with payments are kept.
 */
export async function deletePermanently(req, id, confirmName) {
  const listing = await db.business.findUnique({
    where: { id },
    include: {
      media: { select: { publicId: true } },
      categories: { select: { categoryId: true } },
      _count: { select: { payments: true } },
    },
  })
  if (!listing) throw ApiError.notFound('Listing not found')
  if (!listing.deletedAt) throw ApiError.conflict('Move the listing to Trash first')
  if (confirmName.trim().toLowerCase() !== listing.name.trim().toLowerCase())
    throw ApiError.badRequest('Type the listing name exactly to delete it for good')
  if (listing._count.payments)
    throw ApiError.conflict('This listing has payment records, so it stays in Trash')

  await db.$transaction(async (tx) => {
    await tx.business.delete({ where: { id } })
    await audit(tx, req, {
      action: 'business.delete_permanent',
      entity: 'business',
      entityId: id,
      diff: { name: listing.name, slug: listing.slug },
    })
  })
  const assets = [listing.logoPublicId, ...listing.media.map((m) => m.publicId)].filter(Boolean)
  await Promise.all(assets.map((publicId) => queueMediaDelete(publicId)))
  await afterListingsChange(
    [listing],
    listing.categories.map((c) => c.categoryId),
  )
  return { deleted: true, assetsQueued: assets.length }
}

// What each bulk action writes; checks that need the row come first.
const BULK = {
  publish: { status: 'LIVE' },
  unpublish: { status: 'DRAFT' },
  suspend: { status: 'SUSPENDED' },
  verify: { isVerified: true },
  delete: { deletedAt: 'now' },
  restore: { deletedAt: null },
}

/**
 * Applies one action to many listings. Each listing is its own transaction with an audit
 * log; listings that cannot take the action are reported, not fatal.
 * Returns { done: [ids], failed: [{ id, name, message }] }.
 */
export async function bulkAction(req, { ids, action, categoryId, areaId, featuredUntil }) {
  const inTrash = action === 'restore'
  const listings = await db.business.findMany({
    where: { id: { in: ids }, deletedAt: inTrash ? { not: null } : null },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      ownerId: true,
      categories: { select: { categoryId: true } },
    },
  })
  const found = new Set(listings.map((l) => l.id))
  const failed = ids
    .filter((id) => !found.has(id))
    .map((id) => ({
      id,
      name: null,
      message: inTrash ? 'Not in Trash' : 'Not found or in Trash',
    }))

  if (action === 'set-category') {
    const category = await db.category.findFirst({
      where: { id: categoryId, kind: 'DIRECTORY', parentId: { not: null } },
    })
    if (!category) throw ApiError.validation([{ path: 'categoryId', message: 'Pick a category' }])
  }
  if (action === 'set-area' && areaId) {
    if (!(await db.area.findUnique({ where: { id: areaId } })))
      throw ApiError.validation([{ path: 'areaId', message: 'Unknown area' }])
  }

  const checkRules = action === 'publish' && PUBLISH_RULES_ENFORCED
  const rules = checkRules ? await ruleInputs(db, [...found]) : new Map()
  const until =
    action === 'feature'
      ? new Date(featuredUntil ?? Date.now() + DEFAULT_FEATURE_DAYS * DAY_MS)
      : null
  const done = []
  const touchedCategories = new Set()

  for (const listing of listings) {
    if (checkRules && listing.status !== 'LIVE') {
      const problems = publishProblems(rules.get(listing.id))
      if (problems.length) {
        failed.push({
          id: listing.id,
          name: listing.name,
          message: publishBlocked(problems).message,
        })
        continue
      }
    }
    await db.$transaction(async (tx) => {
      let data = BULK[action] ? { ...BULK[action] } : {}
      if (data.deletedAt === 'now') data.deletedAt = new Date()
      if (action === 'set-area') data = { areaId: areaId ?? null }
      if (action === 'feature') data = { featuredUntil: until }
      if (action === 'unfeature') data = { featuredUntil: null }
      if (action === 'set-category') {
        // The new primary category; the old primary is dropped, other categories stay.
        await tx.businessCategory.deleteMany({
          where: { businessId: listing.id, OR: [{ isPrimary: true }, { categoryId }] },
        })
        await tx.businessCategory.create({
          data: { businessId: listing.id, categoryId, isPrimary: true },
        })
      }
      const row = Object.keys(data).length
        ? await tx.business.update({ where: { id: listing.id }, data })
        : listing
      if (action === 'publish') await promoteOwner(tx, row)
      if (['set-area', 'set-category'].includes(action)) await refreshProfileScore(tx, listing.id)
      await audit(tx, req, {
        action: `business.bulk_${action.replace('-', '_')}`,
        entity: 'business',
        entityId: listing.id,
        // Through JSON so dates are stored as ISO strings.
        diff: JSON.parse(JSON.stringify({ ...data, ...(categoryId && { categoryId }) })),
      })
    })
    done.push(listing.id)
    listing.categories.forEach((c) => touchedCategories.add(c.categoryId))
    if (categoryId) touchedCategories.add(categoryId)
  }

  await afterListingsChange(
    listings.filter((l) => done.includes(l.id)),
    [...touchedCategories],
  )
  return { done, failed }
}
