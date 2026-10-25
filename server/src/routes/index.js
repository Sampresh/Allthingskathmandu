import { Router } from 'express'
import { authRouter } from './auth.routes.js'
import { publicRouter } from './public.routes.js'

// Mounted at /api/v1. Each domain router (*.routes.js) is added here.
export const apiRouter = Router()

apiRouter.use('/auth', authRouter)
apiRouter.use('/public', publicRouter)
