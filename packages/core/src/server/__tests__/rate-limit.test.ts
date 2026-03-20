import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createTokenBucket } from '../rate-limit.js'

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

    // Advance half the window — should refill ~2.5 → 2 tokens
    vi.advanceTimersByTime(30_000)

    const result = bucket.consume('ip1')
    expect(result.allowed).toBe(true)
    expect(result.remaining).toBeGreaterThanOrEqual(1)

    bucket.destroy()
  })

  it('tokens cap at maxRequests after full window', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })

    bucket.consume('ip1')

    // Advance well beyond the window
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
    expect(result.resetMs).toBe(60_000)

    vi.advanceTimersByTime(10_000)

    const result2 = bucket.consume('ip1')
    expect(result2.resetMs).toBe(50_000)

    bucket.destroy()
  })

  it('destroy clears the cleanup interval', () => {
    const bucket = createTokenBucket({ maxRequests: 5, windowMs: 60_000 })
    bucket.consume('ip1')
    bucket.destroy()

    // After destroy, no timers should remain active
    expect(vi.getTimerCount()).toBe(0)
  })
})
