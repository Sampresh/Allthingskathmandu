import { Router } from 'express'
import { adminRouter } from './admin.routes.js'
import { authRouter } from './auth.routes.js'
import { businessRouter } from './business.routes.js'
import { meRouter } from './me.routes.js'
import { publicRouter } from './public.routes.js'

// Mounted at /api/v1. Each domain router (*.routes.js) is added here.
export const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/public', publicRouter)
apiRouter.use('/admin', adminRouter)
apiRouter.use('/business', businessRouter)
apiRouter.use('/me', meRouter)
