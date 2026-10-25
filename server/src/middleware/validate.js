/**
 * Validates and replaces req.params, req.query and req.body with the parsed Zod output.
 * A failure throws a ZodError, which errorHandler turns into VALIDATION_ERROR (400).
 */
export const validate =
  ({ params, query, body }) =>
  (req, res, next) => {
    if (params) req.params = params.parse(req.params)
    if (query) {
      // Express 5 exposes req.query as a getter; redefine it with the parsed value.
      Object.defineProperty(req, 'query', {
        value: query.parse(req.query),
        writable: true,
        configurable: true,
        enumerable: true,
      })
    }
    if (body) req.body = body.parse(req.body ?? {})
    next()
  }
