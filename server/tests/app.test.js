import { describe, it, expect, vi, afterEach } from 'vitest'
import request from 'supertest'
import { createApp } from '../src/app.js'
import { db } from '../src/config/db.js'
import { redis } from '../src/config/redis.js'

const app = createApp()

afterEach(() => vi.restoreAllMocks())

describe('GET /health', () => {
  it('reports db and redis ok', async () => {
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ status: 'ok', db: 'ok', redis: 'ok', version: expect.any(String) })
  })

  it('stays 200 with redis degraded when Redis is down', async () => {
    vi.spyOn(redis, 'ping').mockRejectedValue(new Error('connection refused'))
    const res = await request(app).get('/health')
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ status: 'ok', db: 'ok', redis: 'degraded' })
  })

  it('returns 503 when the database is unreachable', async () => {
    vi.spyOn(db, '$queryRaw').mockRejectedValue(new Error('connection refused'))
    const res = await request(app).get('/health')
    expect(res.status).toBe(503)
    expect(res.body).toMatchObject({ status: 'error', db: 'down' })
  })
})

describe('app pipeline', () => {
  it('returns the error envelope for unknown routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')
    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: expect.any(String), details: [] },
    })
  })

  it('rejects malformed JSON with 400', async () => {
    const res = await request(app)
      .post('/api/v1/anything')
      .set('Content-Type', 'application/json')
      .send('{bad')
    expect(res.status).toBe(400)
    expect(res.body.error.code).toBe('BAD_REQUEST')
  })

  it('sets security headers and hides x-powered-by', async () => {
    const res = await request(app).get('/health')
    expect(res.headers['x-content-type-options']).toBe('nosniff')
    expect(res.headers['strict-transport-security']).toBeDefined()
    expect(res.headers['x-powered-by']).toBeUndefined()
  })

  it('allows credentialed CORS only for CLIENT_URL', async () => {
    const allowed = await request(app).get('/health').set('Origin', 'http://localhost:3000')
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(allowed.headers['access-control-allow-credentials']).toBe('true')

    const other = await request(app).get('/health').set('Origin', 'https://evil.example')
    expect(other.headers['access-control-allow-origin']).not.toBe('https://evil.example')
  })

  it('applies the global rate limit headers to API routes', async () => {
    const res = await request(app).get('/api/v1/does-not-exist')
    expect(res.headers['ratelimit-policy']).toContain('300')
  })
})

describe('HTTPS redirect', () => {
  it('redirects plain HTTP to SERVER_PUBLIC_URL when FORCE_HTTPS is on, except /health', async () => {
    vi.resetModules()
    vi.stubEnv('FORCE_HTTPS', 'true')
    const { createApp: createForcedApp } = await import('../src/app.js')
    const { redis: freshRedis } = await import('../src/config/redis.js')
    const { db: freshDb } = await import('../src/config/db.js')
    try {
      const forced = createForcedApp()
      const res = await request(forced).get('/api/v1/x?y=1')
      expect(res.status).toBe(308)
      expect(res.headers.location).toBe('http://localhost:5001/api/v1/x?y=1')

      const health = await request(forced).get('/health')
      expect(health.status).not.toBe(308)
    } finally {
      vi.unstubAllEnvs()
      await Promise.allSettled([freshRedis.quit(), freshDb.$disconnect()])
    }
  })
})
