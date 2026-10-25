import { Router } from 'express'
import * as market from '../controllers/market.controller.js'
import { cache } from '../middleware/cache.js'
import { submissionLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { idParams } from '../validators/me.validators.js'
import {
  itemBody,
  itemSlugParams,
  itemUpdate,
  marketQuery,
  pageQuery,
} from '../validators/market.validators.js'

const MIN = 60

/** Public marketplace (Part 6 §2), mounted at /public/market. */
export const publicMarketRouter = Router()

// Market categories are edited with the directory taxonomy, which purges `groups`.
publicMarketRouter.get(
  '/categories',
  cache({ ttl: 30 * MIN, tags: () => ['groups'] }),
  market.categories,
)
publicMarketRouter.get(
  '/',
  validate({ query: marketQuery }),
  cache({ ttl: 2 * MIN, tags: () => ['market'] }),
  market.list,
)
publicMarketRouter.get(
  '/:slug',
  validate({ params: itemSlugParams }),
  cache({ ttl: 10 * MIN, tags: (req, body) => [`market:${body.data.id}`] }),
  market.detail,
)

/** A member's own items (Part 6 §4), mounted at /me/market after verifyToken. */
export const memberMarketRouter = Router()

memberMarketRouter.get('/', validate({ query: pageQuery }), market.mine)
memberMarketRouter.post('/', submissionLimiter, validate({ body: itemBody }), market.create)
memberMarketRouter.post('/media/sign', market.signPhoto)
memberMarketRouter.patch(
  '/:id',
  submissionLimiter,
  validate({ params: idParams, body: itemUpdate }),
  market.update,
)
memberMarketRouter.delete('/:id', validate({ params: idParams }), market.remove)
memberMarketRouter.post('/:id/sold', validate({ params: idParams }), market.markSold)
