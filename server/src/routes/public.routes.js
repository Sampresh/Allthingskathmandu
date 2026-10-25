import express, { Router } from 'express'
import * as pub from '../controllers/public.controller.js'
import { optionalAuth } from '../middleware/auth.js'
import { cache } from '../middleware/cache.js'
import {
  contactLimiter,
  reportLimiter,
  searchLimiter,
  trackLimiter,
} from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import {
  contactBody,
  homeQuery,
  pageParams,
  listingsQuery,
  pageQuery,
  reportBody,
  searchQuery,
  similarQuery,
  slugParams,
  suggestQuery,
  trackBody,
} from '../validators/public.validators.js'

export const publicRouter = Router()

const MIN = 60
// Visitor locations make responses personal: never cache those.
const hasPoint = (req) => Boolean(req.query.point)

publicRouter.get(
  '/home',
  validate({ query: homeQuery }),
  cache({ ttl: 5 * MIN, tags: () => ['home'], skip: hasPoint }),
  pub.home,
)

publicRouter.get('/groups', cache({ ttl: 30 * MIN, tags: () => ['groups'] }), pub.groups)

publicRouter.get(
  '/categories/:slug',
  validate({ params: slugParams }),
  cache({ ttl: 10 * MIN, tags: (req, body) => ['groups', `category:${body.data.id}`] }),
  pub.category,
)

publicRouter.get(
  '/categories/:slug/listings',
  validate({ params: slugParams, query: listingsQuery }),
  cache({
    ttl: 5 * MIN,
    tags: (req, body) => [`category:${body.meta.categoryId}`],
    skip: hasPoint,
  }),
  pub.categoryListings,
)

publicRouter.get(
  '/listings/:slug',
  validate({ params: slugParams }),
  cache({ ttl: 10 * MIN, tags: (req, body) => [`listing:${body.data.id}`] }),
  pub.listing,
)

publicRouter.get(
  '/listings/:slug/reviews',
  validate({ params: slugParams, query: pageQuery }),
  cache({ ttl: 5 * MIN, tags: (req, body) => [`listing:${body.meta.businessId}`] }),
  pub.listingReviews,
)

publicRouter.get(
  '/listings/:slug/similar',
  validate({ params: slugParams, query: similarQuery }),
  cache({
    ttl: 10 * MIN,
    tags: (req, body) =>
      [
        `listing:${body.meta.businessId}`,
        body.meta.categoryId && `category:${body.meta.categoryId}`,
      ].filter(Boolean),
  }),
  pub.similarListings,
)

// Popular queries are served from Redis for 2 minutes.
publicRouter.get(
  '/search',
  searchLimiter,
  validate({ query: searchQuery }),
  cache({ ttl: 2 * MIN, tags: () => ['search'], skip: hasPoint }),
  pub.search,
)

publicRouter.get(
  '/search/suggest',
  searchLimiter,
  validate({ query: suggestQuery }),
  cache({ ttl: 2 * MIN, tags: () => ['search'] }),
  pub.suggest,
)

publicRouter.get('/areas', cache({ ttl: 60 * MIN, tags: () => ['areas'] }), pub.areas)
publicRouter.get('/plans', cache({ ttl: 60 * MIN, tags: () => ['plans'] }), pub.plans)
publicRouter.get('/settings', cache({ ttl: 60 * MIN, tags: () => ['settings'] }), pub.settings)

publicRouter.get(
  '/pages/:slug',
  validate({ params: pageParams }),
  cache({ ttl: 60 * MIN, tags: (req) => [`page:${req.params.slug}`] }),
  pub.page,
)

publicRouter.post('/contact', contactLimiter, validate({ body: contactBody }), pub.contact)

// Browsers send track beacons as text/plain (a simple request, so no CORS preflight).
publicRouter.post(
  '/track',
  trackLimiter,
  express.json({ type: 'text/plain', limit: '1kb' }),
  validate({ body: trackBody }),
  pub.track,
)

publicRouter.post(
  '/reports',
  reportLimiter,
  optionalAuth,
  validate({ body: reportBody }),
  pub.report,
)
