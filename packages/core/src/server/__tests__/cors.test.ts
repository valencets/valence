import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createCorsMiddleware } from '../cors.js'
import type { RequestContext } from '../middleware-types.js'

function stubCtx (): RequestContext {
  return {
    requestId: 'test-id',
    startTime: [0, 0] as readonly [number, number],
    url: new URL('http://localhost/'),
    params: {}
  }
}

function mockReq (method: string, headers: Record<string, string | undefined> = {}): IncomingMessage {
  return { method, headers } as unknown as IncomingMessage
}

interface MockRes {
  statusCode: number
  _headers: Record<string, string>
  _body: string
  setHeader: (name: string, value: string) => void
  writeHead: (statusCode: number, headers?: Record<string, string | number>) => void
  end: (body?: string) => void
}

function mockRes (): ServerResponse & MockRes {
  const mock: MockRes = {
    statusCode: 200,
    _headers: {},
    _body: '',
    setHeader (name: string, value: string) {
      mock._headers[name.toLowerCase()] = value
    },
    writeHead (statusCode: number, headers?: Record<string, string | number>) {
      mock.statusCode = statusCode
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          mock._headers[k.toLowerCase()] = String(v)
        }
      }
    },
    end (body?: string) {
      mock._body = body ?? ''
    }
  }
  return mock as unknown as ServerResponse & MockRes
}

describe('createCorsMiddleware', () => {
  const middleware = createCorsMiddleware({
    origins: ['https://example.com', 'https://app.example.com']
  })

  it('passes through same-origin requests (no Origin header)', async () => {
    const req = mockReq('GET')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('allows requests from allowed origin', async () => {
    const req = mockReq('GET', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
    expect((res as unknown as MockRes)._headers['access-control-allow-origin']).toBe('https://example.com')
  })

  it('allows requests from second allowed origin', async () => {
    const req = mockReq('POST', { origin: 'https://app.example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
    expect((res as unknown as MockRes)._headers['access-control-allow-origin']).toBe('https://app.example.com')
  })

  it('rejects requests from disallowed origin with 403', async () => {
    const req = mockReq('GET', { origin: 'https://evil.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).not.toHaveBeenCalled()
    expect((res as unknown as MockRes).statusCode).toBe(403)
    expect(JSON.parse((res as unknown as MockRes)._body)).toEqual({ error: 'Origin not allowed' })
  })

  it('handles OPTIONS preflight with 204', async () => {
    const req = mockReq('OPTIONS', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).not.toHaveBeenCalled()
    expect((res as unknown as MockRes).statusCode).toBe(204)
    expect((res as unknown as MockRes)._headers['access-control-allow-origin']).toBe('https://example.com')
    expect((res as unknown as MockRes)._headers['access-control-allow-methods']).toContain('GET')
    expect((res as unknown as MockRes)._headers['access-control-allow-methods']).toContain('POST')
    expect((res as unknown as MockRes)._headers['access-control-allow-headers']).toContain('Content-Type')
    expect((res as unknown as MockRes)._headers['access-control-allow-headers']).toContain('Authorization')
  })

  it('sets Access-Control-Max-Age header', async () => {
    const req = mockReq('OPTIONS', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes)._headers['access-control-max-age']).toBe('86400')
  })

  it('does not set credentials header by default', async () => {
    const req = mockReq('GET', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes)._headers['access-control-allow-credentials']).toBeUndefined()
  })

  it('sets credentials header when configured', async () => {
    const credMw = createCorsMiddleware({
      origins: ['https://example.com'],
      credentials: true
    })
    const req = mockReq('GET', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await credMw(req, res, stubCtx(), next)

    expect((res as unknown as MockRes)._headers['access-control-allow-credentials']).toBe('true')
  })

  it('uses custom methods when configured', async () => {
    const customMw = createCorsMiddleware({
      origins: ['https://example.com'],
      methods: ['GET', 'POST']
    })
    const req = mockReq('OPTIONS', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await customMw(req, res, stubCtx(), next)

    expect((res as unknown as MockRes)._headers['access-control-allow-methods']).toBe('GET, POST')
  })

  it('uses custom headers when configured', async () => {
    const customMw = createCorsMiddleware({
      origins: ['https://example.com'],
      headers: ['X-Custom-Header']
    })
    const req = mockReq('OPTIONS', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await customMw(req, res, stubCtx(), next)

    expect((res as unknown as MockRes)._headers['access-control-allow-headers']).toBe('X-Custom-Header')
  })

  it('uses custom maxAge when configured', async () => {
    const customMw = createCorsMiddleware({
      origins: ['https://example.com'],
      maxAge: 3600
    })
    const req = mockReq('OPTIONS', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await customMw(req, res, stubCtx(), next)

    expect((res as unknown as MockRes)._headers['access-control-max-age']).toBe('3600')
  })

  it('rejects OPTIONS preflight from disallowed origin', async () => {
    const req = mockReq('OPTIONS', { origin: 'https://evil.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).not.toHaveBeenCalled()
    expect((res as unknown as MockRes).statusCode).toBe(403)
  })
})
