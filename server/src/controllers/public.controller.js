import { ipKeyGenerator } from 'express-rate-limit'
import { readDb } from '../config/db.js'
import * as directory from '../services/directory.js'
import { getHome } from '../services/home.js'
import * as searchService from '../services/search.js'
import { env } from '../config/env.js'
import { queueEmail } from '../services/email.js'
import { createReport, isReportable } from '../services/reports.js'
import { trackEvent } from '../services/stats.js'
import { verifyTurnstile } from '../services/turnstile.js'
import { ApiError } from '../utils/ApiError.js'
import { created, noContent, ok } from '../utils/ApiResponse.js'

const pageMeta = (page) => ({ nextCursor: page.nextCursor })

async function liveListingId(slug) {
  const listing = await readDb.business.findFirst({
    where: { slug, status: 'LIVE', deletedAt: null },
    select: { id: true },
  })
  if (!listing) throw ApiError.notFound('Listing not found')
  return listing.id
}

export async function home(req, res) {
  return ok(res, await getHome({ point: req.query.point }))
}

export async function groups(req, res) {
  return ok(res, await directory.getCategoryTree())
}

export async function emergency(req, res) {
  return ok(res, await directory.getEmergency())
}

export async function category(req, res) {
  const found = await directory.getCategory(req.params.slug)
  if (!found) throw ApiError.notFound('Category not found')
  return ok(res, found)
}

export async function categoryListings(req, res) {
  const found = await directory.getCategory(req.params.slug)
  if (!found) throw ApiError.notFound('Category not found')
  const { point, cursor, limit, ...filters } = req.query
  const page = await directory.listCategoryListings(found, filters, { point, cursor, limit })
  return ok(res, page.items, { ...pageMeta(page), categoryId: found.id })
}

export async function listing(req, res) {
  const found = await directory.getListing(req.params.slug)
  if (!found) throw ApiError.notFound('Listing not found')
  return ok(res, found)
}

export async function listingReviews(req, res) {
  const businessId = await liveListingId(req.params.slug)
  const page = await directory.listReviews(businessId, req.query)
  return ok(res, page.items, { ...pageMeta(page), businessId })
}

export async function similarListings(req, res) {
  const found = await directory.getListing(req.params.slug)
  if (!found) throw ApiError.notFound('Listing not found')
  return ok(res, await directory.listSimilar(found, req.query.limit), {
    businessId: found.id,
    categoryId: found.category?.id ?? null,
  })
}

export async function search(req, res) {
  const result = await searchService.search(req.query)
  return ok(
    res,
    { results: result.items, categories: result.categories, didYouMean: result.didYouMean },
    pageMeta(result),
  )
}

export async function suggest(req, res) {
  return ok(res, await searchService.suggest(req.query.q))
}

export async function areas(req, res) {
  return ok(res, await directory.listAreas())
}

export async function plans(req, res) {
  return ok(res, await directory.listPlans())
}

export async function settings(req, res) {
  return ok(res, await directory.getPublicSettings())
}

export async function track(req, res) {
  await trackEvent({ ...req.body, visitor: ipKeyGenerator(req.ip) })
  return noContent(res)
}

// "Report wrong info": guests (Turnstile) and members (userId is kept).
export async function report(req, res) {
  const { turnstileToken, ...body } = req.body
  await verifyTurnstile(turnstileToken, req.ip)
  if (!(await isReportable(body.entityType, body.entityId))) throw ApiError.notFound()
  await createReport({ ...body, userId: req.user?.id })
  return created(res, { message: 'Thanks. We will check this and fix it.' })
}

export async function page(req, res) {
  const found = await readDb.cmsPage.findFirst({
    where: { slug: req.params.slug, isPublished: true },
    select: {
      slug: true,
      title: true,
      body: true,
      seoTitle: true,
      seoDescription: true,
      updatedAt: true,
    },
  })
  if (!found) throw ApiError.notFound('Page not found')
  return ok(res, found)
}

// Contact form: goes to the address in Settings → contact (else FROM_EMAIL), via the queue.
export async function contact(req, res) {
  const { turnstileToken, name, email, message } = req.body
  await verifyTurnstile(turnstileToken, req.ip)
  const setting = await readDb.setting.findUnique({ where: { key: 'contact' } })
  const to = setting?.value?.email || env.FROM_EMAIL
  await queueEmail(to, 'contact-message', { name, email, message }, { replyTo: email })
  return created(res, { message: 'Thanks. We will reply by email.' })
}
