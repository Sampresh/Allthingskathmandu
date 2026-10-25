import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/config/sentry.js', () => ({
  reportError: vi.fn(),
  flushSentry: vi.fn(async () => true),
  sentryEnabled: true,
}))

const { reportError } = await import('../src/config/sentry.js')
const { errorHandler } = await import('../src/middleware/errorHandler.js')
const { ApiError } = await import('../src/utils/ApiError.js')

function run(err) {
  const res = { status: vi.fn(() => res), json: vi.fn(() => res) }
  const req = { method: 'GET', originalUrl: '/api/v1/x', route: { path: '/x' }, user: { id: 'u1' } }
  errorHandler(err, req, res, () => {})
  return res
}

describe('error reporting', () => {
  beforeEach(() => reportError.mockClear())

  it('reports unexpected errors with the route and user', () => {
    const res = run(new Error('boom'))
    expect(res.status).toHaveBeenCalledWith(500)
    expect(reportError).toHaveBeenCalledWith(expect.any(Error), {
      tags: { method: 'GET', route: '/x' },
      userId: 'u1',
    })
  })

  it('does not report expected errors (4xx and known 503s)', () => {
    run(ApiError.notFound())
    run(ApiError.badRequest('nope'))
    run(ApiError.unavailable('Khalti did not respond'))
    expect(reportError).not.toHaveBeenCalled()
  })
})
