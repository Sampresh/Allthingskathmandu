import { Router } from 'express'
import * as me from '../controllers/me.controller.js'
import { verifyToken } from '../middleware/auth.js'
import { createLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { claimBody, newListingBody } from '../validators/business.validators.js'

export const meRouter = Router()

meRouter.use(verifyToken)
meRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// Submissions that create work for moderators: 10 per hour per account.
const submissions = createLimiter({
  name: 'submissions',
  windowMs: 60 * 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `user:${req.user.id}`,
})

meRouter.get('/claims', me.myClaims)
meRouter.post('/claims/proof/sign', submissions, me.signClaimProof)
meRouter.post('/claims', submissions, validate({ body: claimBody }), me.createClaim)
meRouter.post('/listings', submissions, validate({ body: newListingBody }), me.createPendingListing)
