import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createBodyLimitMiddleware } from '../body-limit.js'
import type { RequestContext } from '../middleware-types.js'
import { EventEmitter } from 'node:events'
import { readBody } from '../http-helpers.js'

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

function stubReqWithStream (options: { method?: string, contentType?: string, chunks: Buffer[] }): IncomingMessage {
  const headers: Record<string, string> = {}
  if (options.contentType !== undefined) {
    headers['content-type'] = options.contentType
  }
  // No content-length header — simulates chunked transfer
  const emitter = new EventEmitter()
  const req = Object.assign(emitter, {
    method: options.method ?? 'GET',
    headers,
    destroy: vi.fn(() => {
      emitter.emit('close')
    })
  })

  // Schedule chunks to be emitted after listeners are attached
  queueMicrotask(() => {
    for (const chunk of options.chunks) {
      req.emit('data', chunk)
    }
    req.emit('end')
  })

  return req as unknown as IncomingMessage
}

function stubReqWithDishonestLength (options: {
  method?: string
  contentType?: string
  contentLength: number
  chunks: Buffer[]
}): IncomingMessage {
  const headers: Record<string, string> = {
    'content-length': String(options.contentLength)
  }
  if (options.contentType !== undefined) {
    headers['content-type'] = options.contentType
  }

  const emitter = new EventEmitter()
  const req = Object.assign(emitter, {
    method: options.method ?? 'POST',
    headers,
    destroy: vi.fn(() => {
      emitter.emit('close')
    })
  })

  queueMicrotask(() => {
    for (const chunk of options.chunks) {
      req.emit('data', chunk)
    }
    req.emit('end')
  })

  return req as unknown as IncomingMessage
}

function stubReqWithLength (options: {
  method?: string
  contentType?: string
  contentLength: number
  chunks: Buffer[]
}): IncomingMessage {
  const headers: Record<string, string> = {
    'content-length': String(options.contentLength)
  }
  if (options.contentType !== undefined) {
    headers['content-type'] = options.contentType
  }

  const emitter = new EventEmitter()
  const req = Object.assign(emitter, {
    method: options.method ?? 'POST',
    headers,
    destroy: vi.fn(() => {
      emitter.emit('close')
    })
  })

  queueMicrotask(() => {
    for (const chunk of options.chunks) {
      req.emit('data', chunk)
    }
    req.emit('end')
  })

  return req as unknown as IncomingMessage
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
      stubReqWithLength({
        method: 'POST',
        contentType: 'application/json',
        contentLength: 50_000,
        chunks: [Buffer.alloc(50_000, 'a')]
      }),
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
      stubReqWithLength({
        method: 'POST',
        contentType: 'multipart/form-data; boundary=----abc',
        contentLength: 4999,
        chunks: [Buffer.alloc(4999, 'a')]
      }),
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
      stubReqWithLength({
        method: 'POST',
        contentType: 'application/json',
        contentLength: 49,
        chunks: [Buffer.alloc(49, 'a')]
      }),
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

  it('rejects chunked POST without Content-Length when body exceeds limit', async () => {
    const middleware = createBodyLimitMiddleware({ json: 100 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    // Simulate a chunked request with no Content-Length header
    const req = stubReqWithStream({
      method: 'POST',
      contentType: 'application/json',
      chunks: [Buffer.alloc(60, 'a'), Buffer.alloc(60, 'b')] // 120 bytes > 100 limit
    })

    await middleware(req, res, stubCtx(), next)

    expect(res.statusCode).toBe(413)
    expect(next).not.toHaveBeenCalled()
  })

  it('allows chunked POST without Content-Length when body is under limit', async () => {
    const middleware = createBodyLimitMiddleware({ json: 200 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    const req = stubReqWithStream({
      method: 'POST',
      contentType: 'application/json',
      chunks: [Buffer.alloc(50, 'a'), Buffer.alloc(50, 'b')] // 100 bytes < 200 limit
    })

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects chunked PUT without Content-Length when body exceeds raw limit', async () => {
    const middleware = createBodyLimitMiddleware({ raw: 50 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    const req = stubReqWithStream({
      method: 'PUT',
      contentType: 'application/octet-stream',
      chunks: [Buffer.alloc(60, 'x')] // 60 bytes > 50 limit
    })

    await middleware(req, res, stubCtx(), next)

    expect(res.statusCode).toBe(413)
    expect(next).not.toHaveBeenCalled()
  })

  it('passes through chunked GET without Content-Length (not a body method)', async () => {
    const middleware = createBodyLimitMiddleware({ json: 10 })
    const next = vi.fn(async () => {})

    const req = stubReqWithStream({
      method: 'GET',
      chunks: []
    })

    await middleware(req, stubRes(), stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects body overflow even when declared Content-Length is under the limit', async () => {
    const middleware = createBodyLimitMiddleware({ json: 100 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    const req = stubReqWithDishonestLength({
      method: 'POST',
      contentType: 'application/json',
      contentLength: 50,
      chunks: [Buffer.alloc(60, 'a'), Buffer.alloc(60, 'b')]
    })

    await middleware(req, res, stubCtx(), next)

    expect(res.statusCode).toBe(413)
    expect(next).not.toHaveBeenCalled()
  })

  it('keeps validated request bodies readable for downstream handlers', async () => {
    const middleware = createBodyLimitMiddleware({ json: 200 })
    const body = '{"ok":true}'
    const req = stubReqWithDishonestLength({
      method: 'POST',
      contentType: 'application/json',
      contentLength: body.length,
      chunks: [Buffer.from(body)]
    })
    const res = stubRes()
    const next = vi.fn(async () => {
      await expect(readBody(req)).resolves.toBe(body)
    })

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects oversized DELETE request bodies', async () => {
    const middleware = createBodyLimitMiddleware({ json: 100 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'DELETE', contentType: 'application/json', contentLength: 101 }),
      res, stubCtx(), next
    )

    expect(res.statusCode).toBe(413)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects body requests that cannot be tracked safely', async () => {
    const middleware = createBodyLimitMiddleware({ json: 100 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(
      stubReq({ method: 'POST', contentType: 'application/json', contentLength: 50 }),
      res, stubCtx(), next
    )

    expect(res.statusCode).toBe(413)
    expect(next).not.toHaveBeenCalled()
  })
})
