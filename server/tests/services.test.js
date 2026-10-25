import { describe, it, expect, vi, afterEach } from 'vitest'
import { decryptSecret, encryptSecret } from '../src/services/totp.js'
import { renderEmail } from '../src/services/email.js'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

describe('TOTP secret encryption', () => {
  it('round-trips and uses a fresh IV each time', () => {
    const a = encryptSecret('JBSWY3DPEHPK3PXP')
    const b = encryptSecret('JBSWY3DPEHPK3PXP')
    expect(a).not.toBe(b)
    expect(decryptSecret(a)).toBe('JBSWY3DPEHPK3PXP')
  })

  it('detects tampering', () => {
    const [v, iv, tag, data] = encryptSecret('JBSWY3DPEHPK3PXP').split(':')
    const flipped = Buffer.from(data, 'base64url')
    flipped[0] ^= 1
    expect(() => decryptSecret([v, iv, tag, flipped.toString('base64url')].join(':'))).toThrow()
  })
})

describe('email templates', () => {
  it('escapes user-provided names in HTML', () => {
    const { html, text } = renderEmail('verify-email', {
      name: '<script>x</script>',
      url: 'http://localhost:3000/verify-email?token=abc',
    })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(text).toContain('http://localhost:3000/verify-email?token=abc')
  })
})

describe('verifyTurnstile', () => {
  async function load(fetchResult) {
    vi.stubEnv('TURNSTILE_SECRET_KEY', 'secret')
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ json: async () => fetchResult })),
    )
    const mod = await import('../src/services/turnstile.js')
    return mod.verifyTurnstile
  }

  it('passes when Cloudflare accepts the token', async () => {
    const verify = await load({ success: true })
    await expect(verify('token', '1.2.3.4')).resolves.toBeUndefined()
    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://challenges.cloudflare.com/turnstile/v0/siteverify')
    expect(init.body.get('secret')).toBe('secret')
    expect(init.body.get('remoteip')).toBe('1.2.3.4')
  })

  it('fails when Cloudflare rejects the token or none is sent', async () => {
    const verify = await load({ success: false })
    await expect(verify('token')).rejects.toMatchObject({ code: 'TURNSTILE_FAILED' })
    await expect(verify(undefined)).rejects.toMatchObject({ statusCode: 400 })
  })
})
