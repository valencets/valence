import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext } from '../middleware-types.js'
import { createOriginCheck } from '../origin-check.js'

function stubCtx (): RequestContext {
  return {
    requestId: 'test-id',
    startTime: [0, 0] as readonly [number, number],
    url: new URL('http://localhost/'),
    params: {}
  }
}

function mockReq (method: string, headers: Record<string, string | undefined> = {}): IncomingMessage {
  return { method, headers, on: vi.fn() } as unknown as IncomingMessage
}

interface MockRes {
  statusCode: number
  _headers: Record<string, string>
  _body: string
  writeHead: (statusCode: number, headers?: Record<string, string | number>) => void
  end: (body?: string) => void
}

function mockRes (): ServerResponse & MockRes {
  const mock = {
    statusCode: 200,
    _headers: {} as Record<string, string>,
    _body: ''
  } as MockRes

  mock.writeHead = (statusCode: number, headers?: Record<string, string | number>) => {
    mock.statusCode = statusCode
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        mock._headers[k.toLowerCase()] = String(v)
      }
    }
  }
  mock.end = (body?: string) => {
    mock._body = body ?? ''
  }

  return mock as unknown as ServerResponse & MockRes
}

describe('createOriginCheck', () => {
  const middleware = createOriginCheck({ allowedOrigins: ['https://example.com'] })

  it('allows GET without checking origin', async () => {
    const req = mockReq('GET')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('allows HEAD without checking origin', async () => {
    const req = mockReq('HEAD')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('allows OPTIONS without checking origin', async () => {
    const req = mockReq('OPTIONS')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('allows POST with matching Origin header', async () => {
    const req = mockReq('POST', { origin: 'https://example.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects POST with 403 when Origin does not match', async () => {
    const req = mockReq('POST', { origin: 'https://evil.com' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes).statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('falls back to Referer header when Origin is absent', async () => {
    const req = mockReq('POST', { referer: 'https://example.com/page' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects 403 when neither Origin nor Referer matches', async () => {
    const req = mockReq('POST')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes).statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('auto-allows localhost origins when isDev is true', async () => {
    const devMiddleware = createOriginCheck({ allowedOrigins: ['https://example.com'], isDev: true })
    const req = mockReq('POST', { origin: 'http://localhost:3000' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await devMiddleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('handles Origin with port numbers correctly', async () => {
    const mw = createOriginCheck({ allowedOrigins: ['https://example.com:8443'] })
    const req = mockReq('POST', { origin: 'https://example.com:8443' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await mw(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })
})
