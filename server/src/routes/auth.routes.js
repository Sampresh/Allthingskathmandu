import { Router } from 'express'
import * as auth from '../controllers/auth.controller.js'
import { verifyToken } from '../middleware/auth.js'
import {
  emailLimiter,
  loginLimiter,
  registerLimiter,
  twoFactorLimiter,
} from '../middleware/rateLimit.js'
import { validate } from '../middleware/validate.js'
import {
  challengeCodeSchema,
  challengeSchema,
  emailOnlySchema,
  googleSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.validators.js'

export const authRouter = Router()

authRouter.use((req, res, next) => {
  res.set('Cache-Control', 'no-store')
  next()
})

authRouter.post('/register', registerLimiter, validate({ body: registerSchema }), auth.register)
authRouter.post('/verify-email', validate({ body: verifyEmailSchema }), auth.verifyEmail)
authRouter.post(
  '/resend-verification',
  emailLimiter,
  validate({ body: emailOnlySchema }),
  auth.resendVerification,
)
authRouter.post('/login', loginLimiter, validate({ body: loginSchema }), auth.login)
authRouter.post('/google', loginLimiter, validate({ body: googleSchema }), auth.google)
authRouter.post('/refresh', auth.refresh)
authRouter.post('/logout', auth.logout)
authRouter.post('/logout-all', verifyToken, auth.logoutAll)
authRouter.post(
  '/forgot-password',
  emailLimiter,
  validate({ body: emailOnlySchema }),
  auth.forgotPassword,
)
authRouter.post('/reset-password', validate({ body: resetPasswordSchema }), auth.resetPassword)
authRouter.post(
  '/2fa/setup',
  twoFactorLimiter,
  validate({ body: challengeSchema }),
  auth.setupTwoFactor,
)
authRouter.post(
  '/2fa/enable',
  twoFactorLimiter,
  validate({ body: challengeCodeSchema }),
  auth.enableTwoFactor,
)
authRouter.post(
  '/2fa/verify',
  twoFactorLimiter,
  validate({ body: challengeCodeSchema }),
  auth.verifyTwoFactor,
)
