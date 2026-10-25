import express from 'express'
import helmet from 'helmet'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { env } from './config/env.js'
import { globalLimiter } from './middleware/rateLimit.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'
import { health } from './controllers/health.controller.js'
import { apiRouter } from './routes/index.js'

// Production traffic passes Cloudflare and then Render's load balancer: trust both hops
// so req.ip is the visitor and req.secure reflects the original scheme.
const TRUSTED_PROXY_HOPS = 2

function httpsRedirect(req, res, next) {
  // /health stays on plain HTTP: platform health checks call the instance directly.
  if (!env.FORCE_HTTPS || req.secure || req.path === '/health') return next()
  res.redirect(308, new URL(req.originalUrl, env.SERVER_PUBLIC_URL).toString())
}

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  // same-site (not helmet's same-origin) so the web app's track beacons, which are no-cors
  // requests from allthingskathmandu.com, are not blocked.
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }))
  app.set('trust proxy', env.isProduction ? TRUSTED_PROXY_HOPS : false)
  app.use(httpsRedirect)
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
  app.use(express.json({ limit: '100kb' }))
  app.use(cookieParser())
  app.use(globalLimiter)

  app.get('/health', health)
  app.use('/api/v1', apiRouter)

  app.use(notFound)
  app.use(errorHandler)

  return app
}
