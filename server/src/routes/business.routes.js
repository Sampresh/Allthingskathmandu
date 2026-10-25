import { Router } from 'express'
import * as business from '../controllers/business.controller.js'
import { verifyToken } from '../middleware/auth.js'
import { requireOwnership } from '../middleware/ownership.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import * as v from '../validators/business.validators.js'

export const businessRouter = Router()

businessRouter.use(verifyToken, requireRole('BUSINESS_OWNER'))
businessRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

businessRouter.get('/listings', business.myListings)

// Every :id route checks the listing belongs to the caller (requireOwnership).
const own = [validate({ params: v.idParams }), requireOwnership]
const ownWith = (schemas) => [validate({ params: v.idParams, ...schemas }), requireOwnership]

businessRouter.get('/listings/:id', ...own, business.getListing)
businessRouter.patch(
  '/listings/:id',
  ...ownWith({ body: v.ownerListingUpdate }),
  business.updateListingDetails,
)
businessRouter.put('/listings/:id/hours', ...ownWith({ body: v.hoursBody }), business.putHours)
businessRouter.put(
  '/listings/:id/location',
  ...ownWith({ body: v.locationBody }),
  business.putLocation,
)
businessRouter.post('/listings/:id/logo/sign', ...own, business.signLogo)

businessRouter.post('/listings/:id/media/sign', ...own, business.signMedia)
businessRouter.post('/listings/:id/media', ...ownWith({ body: v.mediaBody }), business.addMedia)
businessRouter.patch(
  '/listings/:id/media/order',
  ...ownWith({ body: v.mediaOrderBody }),
  business.reorderMedia,
)
businessRouter.delete(
  '/listings/:id/media/:mediaId',
  validate({ params: v.mediaParams }),
  requireOwnership,
  business.deleteMedia,
)

businessRouter.get('/listings/:id/offers', ...own, business.listOffers)
businessRouter.post(
  '/listings/:id/offers',
  ...ownWith({ body: v.offerCreate }),
  business.createOffer,
)
businessRouter.patch(
  '/listings/:id/offers/:offerId',
  validate({ params: v.offerParams, body: v.offerUpdate }),
  requireOwnership,
  business.updateOffer,
)
businessRouter.delete(
  '/listings/:id/offers/:offerId',
  validate({ params: v.offerParams }),
  requireOwnership,
  business.deleteOffer,
)

businessRouter.get('/listings/:id/stats', ...ownWith({ query: v.statsQuery }), business.stats)
businessRouter.get('/listings/:id/subscription', ...own, business.subscription)
businessRouter.get('/listings/:id/invoices', ...own, business.invoices)
