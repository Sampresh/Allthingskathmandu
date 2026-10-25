import { Router } from 'express'
import * as me from '../controllers/me.controller.js'
import { verifyToken } from '../middleware/auth.js'
import { createLimiter } from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import { claimBody, newListingBody } from '../validators/business.validators.js'
import {
  businessParams,
  deleteAccountBody,
  idParams,
  pageQuery,
  passwordBody,
  profileBody,
  reviewBody,
  reviewPatchBody,
  savedQuery,
} from '../validators/me.validators.js'

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

// Endpoints that check the current password: 5 per 15 min per account, like login.
const passwordChecks = createLimiter({
  name: 'password-check',
  windowMs: 15 * 60 * 1000,
  limit: 5,
  keyGenerator: (req) => `user:${req.user.id}`,
})

meRouter.get('/', me.getProfile)
meRouter.patch('/', validate({ body: profileBody }), me.updateProfile)
meRouter.delete('/', passwordChecks, validate({ body: deleteAccountBody }), me.deleteAccount)
meRouter.patch('/password', passwordChecks, validate({ body: passwordBody }), me.changePassword)

meRouter.get('/sessions', me.listSessions)
meRouter.delete('/sessions/:id', validate({ params: idParams }), me.endSession)

meRouter.get('/saved', validate({ query: savedQuery }), me.listSaved)
meRouter.put('/saved/:businessId', validate({ params: businessParams }), me.saveListing)
meRouter.delete('/saved/:businessId', validate({ params: businessParams }), me.unsaveListing)

meRouter.get('/reviews', validate({ query: pageQuery }), me.myReviews)
meRouter.post('/reviews', submissions, validate({ body: reviewBody }), me.createReview)
meRouter.patch(
  '/reviews/:id',
  submissions,
  validate({ params: idParams, body: reviewPatchBody }),
  me.updateReview,
)
meRouter.delete('/reviews/:id', validate({ params: idParams }), me.deleteReview)

meRouter.get('/claims', me.myClaims)
meRouter.post('/claims/proof/sign', submissions, me.signClaimProof)
meRouter.post('/claims', submissions, validate({ body: claimBody }), me.createClaim)
meRouter.post('/listings', submissions, validate({ body: newListingBody }), me.createPendingListing)
