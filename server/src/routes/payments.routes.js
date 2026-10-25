import { Router } from 'express'
import * as payments from '../controllers/payments.controller.js'
import { verifyToken } from '../middleware/auth.js'
import { createLimiter } from '../middleware/rateLimit.js'
import { requireRole } from '../middleware/requireRole.js'
import { validate } from '../middleware/validate.js'
import {
  esewaVerifyBody,
  initiateBody,
  khaltiVerifyBody,
} from '../validators/payments.validators.js'

export const paymentsRouter = Router()

paymentsRouter.use(verifyToken, requireRole('BUSINESS_OWNER'))
paymentsRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

// Payment initiate: 10 per minute per user (Part 6 §8).
const initiateLimiter = createLimiter({
  name: 'pay-initiate',
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `user:${req.user.id}`,
})

paymentsRouter.post(
  '/khalti/initiate',
  initiateLimiter,
  validate({ body: initiateBody }),
  payments.khaltiInitiate,
)
paymentsRouter.post('/khalti/verify', validate({ body: khaltiVerifyBody }), payments.khaltiVerify)
paymentsRouter.post(
  '/esewa/initiate',
  initiateLimiter,
  validate({ body: initiateBody }),
  payments.esewaInitiate,
)
paymentsRouter.post('/esewa/verify', validate({ body: esewaVerifyBody }), payments.esewaVerify)
