export interface RateLimitConfig {
  readonly maxRequests: number
  readonly windowMs: number
}

export interface RateLimitResult {
  readonly allowed: boolean
  readonly remaining: number
  readonly resetMs: number
  readonly limit: number
}

export interface TokenBucket {
  consume(key: string): RateLimitResult
  reset(key: string): void
  destroy(): void
}

interface BucketEntry {
  tokens: number
  lastRefill: number
  windowStart: number
}

const CLEANUP_INTERVAL_MS = 300_000

export function createTokenBucket (config: RateLimitConfig): TokenBucket {
  const { maxRequests, windowMs } = config
  const buckets = new Map<string, BucketEntry>()
  const refillRate = maxRequests / windowMs

  const cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of buckets) {
      const elapsed = now - entry.lastRefill
      if (elapsed >= windowMs) {
        buckets.delete(key)
      }
    }
  }, CLEANUP_INTERVAL_MS)

  function refill (entry: BucketEntry, now: number): void {
    const elapsed = now - entry.lastRefill
    if (elapsed > 0) {
      const tokensToAdd = elapsed * refillRate
      entry.tokens = Math.min(maxRequests, entry.tokens + tokensToAdd)
      entry.lastRefill = now
    }
  }

  function consume (key: string): RateLimitResult {
    const now = Date.now()
    let entry = buckets.get(key)
    if (entry === undefined) {
      entry = { tokens: maxRequests, lastRefill: now, windowStart: now }
      buckets.set(key, entry)
    } else {
      refill(entry, now)
    }

    const elapsed = now - entry.windowStart
    const resetMs = elapsed >= windowMs
      ? windowMs
      : windowMs - elapsed

    if (entry.tokens < 1) {
      return { allowed: false, remaining: 0, resetMs, limit: maxRequests }
    }

    entry.tokens -= 1
    return {
      allowed: true,
      remaining: Math.floor(entry.tokens),
      resetMs,
      limit: maxRequests
    }
  }

  function reset (key: string): void {
    buckets.delete(key)
  }

  function destroy (): void {
    clearInterval(cleanupTimer)
    buckets.clear()
  }

  return { consume, reset, destroy }
}

import type { IncomingMessage } from 'node:http'
import type { Middleware } from './middleware-types.js'

export interface RateLimitMiddlewareConfig {
  readonly maxRequests: number
  readonly windowMs: number
  readonly trustProxy?: boolean
}

interface RateLimitMiddlewareHandle {
  readonly middleware: Middleware
  readonly destroy: () => void
}

function resolveClientIp (req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const forwarded = req.headers['x-forwarded-for']
    if (typeof forwarded === 'string') {
      const first = forwarded.split(',')[0]
      if (first !== undefined) {
        return first.trim()
      }
    }
  }
  return req.socket.remoteAddress ?? '0.0.0.0'
}

export function createRateLimitMiddleware (config: RateLimitMiddlewareConfig): RateLimitMiddlewareHandle {
  const { maxRequests, windowMs, trustProxy } = config
  const bucket = createTokenBucket({ maxRequests, windowMs })
  const proxy = trustProxy === true

  const middleware: Middleware = async (req, res, _ctx, next) => {
    const key = resolveClientIp(req, proxy)
    const result = bucket.consume(key)

    res.setHeader('X-RateLimit-Limit', String(result.limit))
    res.setHeader('X-RateLimit-Remaining', String(result.remaining))
    res.setHeader('X-RateLimit-Reset', String(Math.ceil((Date.now() + result.resetMs) / 1000)))

    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil(result.resetMs / 1000)
      res.setHeader('Retry-After', String(retryAfterSeconds))
      const body = JSON.stringify({ error: 'Too many requests' })
      res.writeHead(429, {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Length': Buffer.byteLength(body)
      })
      res.end(body)
      return
    }

    await next()
  }

  function destroy (): void {
    bucket.destroy()
  }

  return { middleware, destroy }
}
