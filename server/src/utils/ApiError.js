export class ApiError extends Error {
  constructor(statusCode, code, message, details = []) {
    super(message)
    this.name = 'ApiError'
    this.statusCode = statusCode
    this.code = code
    this.details = details
  }

  static badRequest(message = 'Bad request', details = []) {
    return new ApiError(400, 'BAD_REQUEST', message, details)
  }

  static validation(details = [], message = 'Invalid input') {
    return new ApiError(400, 'VALIDATION_ERROR', message, details)
  }

  static unauthorized(message = 'Authentication required', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message)
  }

  static forbidden(message = 'You do not have access to this resource', code = 'FORBIDDEN') {
    return new ApiError(403, code, message)
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, 'NOT_FOUND', message)
  }

  static conflict(message = 'Already exists', details = []) {
    return new ApiError(409, 'CONFLICT', message, details)
  }

  static tooMany(message = 'Too many requests, please try again later') {
    return new ApiError(429, 'RATE_LIMITED', message)
  }

  static unavailable(message = 'Service temporarily unavailable') {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message)
  }
}
