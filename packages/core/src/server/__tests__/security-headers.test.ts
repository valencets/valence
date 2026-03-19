import { describe, it, expect } from 'vitest'
import type { ServerResponse } from 'node:http'
import { setSecurityHeaders, SECURITY_HEADERS, generateNonce } from '../security-headers.js'

function mockRes (): ServerResponse & { _headers: Record<string, string> } {
  const headers: Record<string, string> = {}
  const res = {
    _headers: headers,
    setHeader (name: string, value: string) {
      headers[name] = value
    },
    getHeader (name: string): string | undefined {
      return headers[name]
    }
  }
  return res as unknown as ServerResponse & { _headers: Record<string, string> }
}

describe('SECURITY_HEADERS', () => {
  it('is a frozen record of header name-value pairs', () => {
    expect(Object.isFrozen(SECURITY_HEADERS)).toBe(true)
    expect(typeof SECURITY_HEADERS).toBe('object')
  })

  it('includes X-Content-Type-Options', () => {
    expect(SECURITY_HEADERS['X-Content-Type-Options']).toBe('nosniff')
  })

  it('includes X-Frame-Options', () => {
    expect(SECURITY_HEADERS['X-Frame-Options']).toBe('DENY')
  })

  it('includes Content-Security-Policy', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy']
    expect(csp).toContain("default-src 'self'")
    expect(csp).toContain("script-src 'self'")
    expect(csp).toContain("style-src 'self' 'unsafe-inline'")
    expect(csp).toContain("img-src 'self' data:")
    expect(csp).toContain("font-src 'self'")
    expect(csp).toContain("object-src 'none'")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('includes base-uri, form-action, and connect-src in CSP', () => {
    const csp = SECURITY_HEADERS['Content-Security-Policy']
    expect(csp).toContain("base-uri 'self'")
    expect(csp).toContain("form-action 'self'")
    expect(csp).toContain("connect-src 'self'")
  })

  it('includes Strict-Transport-Security', () => {
    expect(SECURITY_HEADERS['Strict-Transport-Security']).toBe('max-age=31536000; includeSubDomains')
  })

  it('includes Referrer-Policy', () => {
    expect(SECURITY_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('includes Permissions-Policy', () => {
    const pp = SECURITY_HEADERS['Permissions-Policy']
    expect(pp).toContain('camera=()')
    expect(pp).toContain('microphone=()')
    expect(pp).toContain('geolocation=()')
  })

  it('includes Cross-Origin-Opener-Policy', () => {
    expect(SECURITY_HEADERS['Cross-Origin-Opener-Policy']).toBe('same-origin')
  })

  it('includes Cross-Origin-Resource-Policy', () => {
    expect(SECURITY_HEADERS['Cross-Origin-Resource-Policy']).toBe('same-origin')
  })
})

describe('generateNonce', () => {
  it('returns a base64 string of 24 characters', () => {
    const nonce = generateNonce()
    expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/)
    expect(nonce).toHaveLength(24)
  })

  it('returns different values on each call', () => {
    const a = generateNonce()
    const b = generateNonce()
    expect(a).not.toBe(b)
  })
})

describe('setSecurityHeaders', () => {
  it('sets all security headers on the response', () => {
    const res = mockRes()
    setSecurityHeaders(res)

    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      expect(res._headers[name]).toBe(value)
    }
  })

  it('does not remove existing headers', () => {
    const res = mockRes()
    res.setHeader('X-Custom', 'keep-me')
    setSecurityHeaders(res)

    expect(res._headers['X-Custom']).toBe('keep-me')
    expect(res._headers['X-Content-Type-Options']).toBe('nosniff')
  })

  it('injects nonce into script-src when provided', () => {
    const res = mockRes()
    setSecurityHeaders(res, { nonce: 'abc123' })

    const csp = res._headers['Content-Security-Policy']
    expect(csp).toContain("script-src 'self' 'nonce-abc123'")
  })

  it('omits nonce from script-src when not provided', () => {
    const res = mockRes()
    setSecurityHeaders(res)

    const csp = res._headers['Content-Security-Policy']
    expect(csp).toContain("script-src 'self'")
    expect(csp).not.toContain('nonce-')
  })
})
