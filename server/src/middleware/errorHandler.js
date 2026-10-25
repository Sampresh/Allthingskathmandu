import { ZodError } from 'zod'
import { env } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'
import { logger } from '../utils/logger.js'

function toApiError(err) {
  if (err instanceof ApiError) return err

  if (err instanceof ZodError) {
    return ApiError.validation(
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    )
  }

  // body-parser errors
  if (err.type === 'entity.parse.failed') return ApiError.badRequest('Malformed JSON body')
  if (err.type === 'entity.too.large') {
    return new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large')
  }

  // Prisma known request errors
  if (err.name === 'PrismaClientKnownRequestError') {
    if (err.code === 'P2002') return ApiError.conflict('A record with this value already exists')
    if (err.code === 'P2025') return ApiError.notFound()
  }

  return null
}

// Express 5 forwards rejected promises here, so controllers can simply throw.
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  const known = toApiError(err)

  if (known) {
    if (known.statusCode >= 500) logger.error(err)
    return res.status(known.statusCode).json({
      success: false,
      error: { code: known.code, message: known.message, details: known.details },
    })
  }

  logger.error(err, { method: req.method, path: req.originalUrl })
  return res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: env.isProduction ? 'Something went wrong' : err.message,
      details: [],
    },
  })
}

export function notFound(req, res, next) {
  next(ApiError.notFound(`Route not found: ${req.method} ${req.path}`))
}
