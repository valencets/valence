import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createBodyLimitMiddleware } from '../body-limit.js'
import type { RequestContext } from '../middleware-types.js'

function stubReq (options?: { method?: string, contentType?: string, contentLength?: number }): IncomingMessage {
  const headers: Record<string, string> = {}
  if (options?.contentType !== undefined) {
    headers['content-type'] = options.contentType
  }
  if (options?.contentLength !== undefined) {
    headers['content-length'] = String(options.contentLength)
  }
  return {
    method: options?.method ?? 'GET',
    headers
  } as unknown as IncomingMessage
}

function stubRes (): ServerResponse & { written: string, statusCode: number, headers: Record<string, string> } {
  const headers: Record<string, string> = {}
  let written = ''
  let statusCode = 200
  return {
    get written () { return written },
    get statusCode () { return statusCode },
    get headers () { return headers },
    setHeader (name: string, value: string) { headers[name.toLowerCase()] = String(value) },
    writeHead (code: number, hdrs?: Record<string, string | number>) {
      statusCode = code
      if (hdrs) {
        for (const [k, v] of Object.entries(hdrs)) {
          headers[k.toLowerCase()] = String(v)
        }
      }
      return this
    },
    end (body?: string) { if (body) written = body }
  } as unknown as ServerResponse & { written: string, statusCode: number, headers: Record<string, string> }
}

function stubCtx (): RequestContext {
  return {
    requestId: 'test-id',
    startTime: [0, 0] as readonly [number, number],
    url: new URL('http://localhost/'),
    params: {}
  }
}

describe('createBodyLimitMiddleware', () => {
  it('passes through GET requests', async () => {
    const middleware = createBodyLimitMiddleware()
    const next = vi.fn(async () => {})
    await middleware(stubReq({ method: 'GET' }), stubRes(), stubCtx(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('passes through HEAD requests', async () => {
    const middleware = createBodyLimitMiddleware()
    const next = vi.fn(async () => {})
    await middleware(stubReq({ method: 'HEAD' }), stubRes(), stubCtx(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('passes through OPTIONS requests', async () => {
    const middleware = createBodyLimitMiddleware()
    const next = vi.fn(async () => {})
    await middleware(stubReq({ method: 'OPTIONS' }), stubRes(), stubCtx(), next)
    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects POST with Content-Length exceeding json limit', async () => {
    const middleware = createBodyLimitMiddleware()
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'POST', contentType: 'application/json', contentLength: 200_000 }),
      res, stubCtx(), next
    )

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(413)
    expect(JSON.parse(res.written)).toEqual({ error: 'Request entity too large' })
  })

  it('allows POST with Content-Length under json limit', async () => {
    const middleware = createBodyLimitMiddleware()
    const next = vi.fn(async () => {})

    await middleware(
      stubReq({ method: 'POST', contentType: 'application/json', contentLength: 50_000 }),
      stubRes(), stubCtx(), next
    )

    expect(next).toHaveBeenCalledOnce()
  })

  it('uses json limit for application/json', async () => {
    const middleware = createBodyLimitMiddleware({ json: 1000 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'POST', contentType: 'application/json', contentLength: 1001 }),
      res, stubCtx(), next
    )

    expect(res.statusCode).toBe(413)
  })

  it('uses form limit for application/x-www-form-urlencoded', async () => {
    const middleware = createBodyLimitMiddleware({ form: 500 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'POST', contentType: 'application/x-www-form-urlencoded', contentLength: 501 }),
      res, stubCtx(), next
    )

    expect(res.statusCode).toBe(413)
  })

  it('uses multipart limit for multipart/form-data', async () => {
    const middleware = createBodyLimitMiddleware({ multipart: 5000 })
    const next = vi.fn(async () => {})

    // Under limit — should pass
    await middleware(
      stubReq({ method: 'POST', contentType: 'multipart/form-data; boundary=----abc', contentLength: 4999 }),
      stubRes(), stubCtx(), next
    )
    expect(next).toHaveBeenCalledOnce()

    // Over limit — should reject
    const res = stubRes()
    const next2 = vi.fn(async () => {})
    await middleware(
      stubReq({ method: 'POST', contentType: 'multipart/form-data; boundary=----abc', contentLength: 5001 }),
      res, stubCtx(), next2
    )
    expect(res.statusCode).toBe(413)
  })

  it('uses raw limit for unknown content types', async () => {
    const middleware = createBodyLimitMiddleware({ raw: 2000 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'PUT', contentType: 'application/octet-stream', contentLength: 2001 }),
      res, stubCtx(), next
    )

    expect(res.statusCode).toBe(413)
  })

  it('custom config overrides defaults', async () => {
    const middleware = createBodyLimitMiddleware({ json: 50 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'POST', contentType: 'application/json', contentLength: 51 }),
      res, stubCtx(), next
    )

    expect(res.statusCode).toBe(413)

    // Under custom limit should pass
    const next2 = vi.fn(async () => {})
    await middleware(
      stubReq({ method: 'POST', contentType: 'application/json', contentLength: 49 }),
      stubRes(), stubCtx(), next2
    )
    expect(next2).toHaveBeenCalledOnce()
  })

  it('applies to PATCH requests', async () => {
    const middleware = createBodyLimitMiddleware({ json: 100 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'PATCH', contentType: 'application/json', contentLength: 101 }),
      res, stubCtx(), next
    )

    expect(res.statusCode).toBe(413)
  })
})
