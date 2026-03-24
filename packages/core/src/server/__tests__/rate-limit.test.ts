import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createTokenBucket, createRateLimitMiddleware } from '../rate-limit.js'
import type { RequestContext } from '../middleware-types.js'

function stubReq (options?: { remoteAddress?: string, xForwardedFor?: string }): IncomingMessage {
  const headers: Record<string, string> = {}
  if (options?.xForwardedFor !== undefined) {
    headers['x-forwarded-for'] = options.xForwardedFor
  }
  return {
    headers,
    socket: { remoteAddress: options?.remoteAddress ?? '127.0.0.1' }
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
    getHeader (name: string) { return headers[name.toLowerCase()] },
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

describe('createTokenBucket', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('first consume returns allowed with remaining decremented', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })
    const result = bucket.consume('ip1')

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)
    expect(result.limit).toBe(5)

    bucket.destroy()
  })

  it('returns allowed false after max requests exhausted', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })

    for (let i = 0; i < 5; i++) {
      bucket.consume('ip1')
    }

    const result = bucket.consume('ip1')
    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)

    bucket.destroy()
  })

  it('tracks different keys independently', () => {
    const bucket = createTokenBucket({ maxRequests: 2, windowMs: 60_000 })

    bucket.consume('ip1')
    bucket.consume('ip1')
    const ip1Result = bucket.consume('ip1')

    const ip2Result = bucket.consume('ip2')

    expect(ip1Result.allowed).toBe(false)
    expect(ip2Result.allowed).toBe(true)
    expect(ip2Result.remaining).toBe(1)

    bucket.destroy()
  })

  it('refills tokens over time', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })

    for (let i = 0; i < 5; i++) {
      bucket.consume('ip1')
    }

    expect(bucket.consume('ip1').allowed).toBe(false)

    vi.advanceTimersByTime(30_000)

    const result = bucket.consume('ip1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThanOrEqual(1)

    bucket.destroy()
  })

  it('tokens cap at maxRequests after full window', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })

    bucket.consume('ip1')

    vi.advanceTimersByTime(120_000)

    const result = bucket.consume('ip1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(4)

    bucket.destroy()
  })

  it('reset restores key to full tokens', () => {
    const bucket = createTokenBucket({ maxRequests: 3, windowMs: 60_000 })

    bucket.consume('ip1')
    bucket.consume('ip1')
    bucket.consume('ip1')

    expect(bucket.consume('ip1').allowed).toBe(false)

    bucket.reset('ip1')

    const result = bucket.consume('ip1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(2)

    bucket.destroy()
  })

  it('consume returns correct resetMs', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })

    const result = bucket.consume('ip1')
    expect(result.resetMs).toBe(12_000)

    vi.advanceTimersByTime(10_000)

    const result2 = bucket.consume('ip1')
    expect(result2.resetMs).toBe(2_000)

    bucket.destroy()
  })

  it('destroy clears the cleanup interval', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })
    bucket.consume('ip1')
    bucket.destroy()

    expect(vi.getTimerCount()).toBe(0)
  })
})

describe('createRateLimitMiddleware', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls next when under rate limit', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 5, windowMs: 60_000 })
    const next = vi.fn(async () => {})
    const res = stubRes()

    await middleware(stubReq(), res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
    destroy()
  })

  it('responds 429 with JSON error when over limit', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 })
    const next = vi.fn(async () => {})

    await middleware(stubReq(), stubRes(), stubCtx(), next)

    const res = stubRes()
    const next2 = vi.fn(async () => {})
    await middleware(stubReq(), res, stubCtx(), next2)

    expect(next2).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(429)
    expect(JSON.parse(res.written)).toEqual({ error: 'Too many requests' })

    destroy()
  })

  it('sets X-RateLimit-Limit header on all responses', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 })
    const res = stubRes()
    await middleware(stubReq(), res, stubCtx(), vi.fn(async () => {}))

    expect(res.headers['x-ratelimit-limit']).toBe('10')
    destroy()
  })

  it('sets X-RateLimit-Remaining header on all responses', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 })
    const res = stubRes()
    await middleware(stubReq(), res, stubCtx(), vi.fn(async () => {}))

    expect(res.headers['x-ratelimit-remaining']).toBe('9')
    destroy()
  })

  it('sets X-RateLimit-Reset header on all responses', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 10, windowMs: 60_000 })
    const res = stubRes()
    await middleware(stubReq(), res, stubCtx(), vi.fn(async () => {}))

    const resetHeader = res.headers['x-ratelimit-reset']
    expect(resetHeader).toBeDefined()
    expect(Number(resetHeader)).toBeGreaterThan(0)
    destroy()
  })

  it('sets Retry-After header on 429 responses only', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 })

    const res1 = stubRes()
    await middleware(stubReq(), res1, stubCtx(), vi.fn(async () => {}))
    expect(res1.headers['retry-after']).toBeUndefined()

    const res2 = stubRes()
    await middleware(stubReq(), res2, stubCtx(), vi.fn(async () => {}))
    expect(res2.headers['retry-after']).toBeDefined()
    expect(Number(res2.headers['retry-after'])).toBe(60)

    destroy()
  })

  it('unblocks before full window expiry as tokens refill', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 5, windowMs: 60_000 })

    for (let i = 0; i < 5; i++) {
      await middleware(stubReq(), stubRes(), stubCtx(), vi.fn(async () => {}))
    }

    const blockedRes = stubRes()
    const blockedNext = vi.fn(async () => {})
    await middleware(stubReq(), blockedRes, stubCtx(), blockedNext)
    expect(blockedRes.statusCode).toBe(429)
    expect(blockedRes.headers['retry-after']).toBe('12')

    vi.advanceTimersByTime(12_000)

    const recoveredRes = stubRes()
    const recoveredNext = vi.fn(async () => {})
    await middleware(stubReq(), recoveredRes, stubCtx(), recoveredNext)
    expect(recoveredNext).toHaveBeenCalledOnce()

    destroy()
  })

  it('keys by req.socket.remoteAddress by default', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 })

    await middleware(stubReq({ remoteAddress: '1.2.3.4' }), stubRes(), stubCtx(), vi.fn(async () => {}))

    const next1 = vi.fn(async () => {})
    await middleware(stubReq({ remoteAddress: '1.2.3.4' }), stubRes(), stubCtx(), next1)
    expect(next1).not.toHaveBeenCalled()

    const next2 = vi.fn(async () => {})
    await middleware(stubReq({ remoteAddress: '5.6.7.8' }), stubRes(), stubCtx(), next2)
    expect(next2).toHaveBeenCalledOnce()

    destroy()
  })

  it('keys by X-Forwarded-For when trustProxy is true', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000, trustProxy: true })

    await middleware(
      stubReq({ remoteAddress: '127.0.0.1', xForwardedFor: '10.0.0.1, 192.168.1.1' }),
      stubRes(), stubCtx(), vi.fn(async () => {})
    )

    const next = vi.fn(async () => {})
    await middleware(
      stubReq({ remoteAddress: '127.0.0.2', xForwardedFor: '10.0.0.1' }),
      stubRes(), stubCtx(), next
    )
    expect(next).not.toHaveBeenCalled()

    destroy()
  })

  it('ignores X-Forwarded-For when trustProxy is false', async () => {
    const { middleware, destroy } = createRateLimitMiddleware({ maxRequests: 1, windowMs: 60_000 })

    await middleware(
      stubReq({ remoteAddress: '1.2.3.4', xForwardedFor: '10.0.0.1' }),
      stubRes(), stubCtx(), vi.fn(async () => {})
    )

    const next = vi.fn(async () => {})
    await middleware(
      stubReq({ remoteAddress: '1.2.3.4', xForwardedFor: '10.0.0.2' }),
      stubRes(), stubCtx(), next
    )
    expect(next).not.toHaveBeenCalled()

    destroy()
  })
})
