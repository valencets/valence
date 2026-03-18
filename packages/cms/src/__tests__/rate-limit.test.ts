import { describe, it, expect, beforeEach } from 'vitest'
import { createRateLimiter } from '../auth/rate-limit.js'

describe('createRateLimiter()', () => {
  let limiter: ReturnType<typeof createRateLimiter>

  beforeEach(() => {
    limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })
  })

  it('allows requests under the limit', () => {
    expect(limiter.check('user@test.com')).toBe(true)
    expect(limiter.check('user@test.com')).toBe(true)
    expect(limiter.check('user@test.com')).toBe(true)
  })

  it('blocks after exceeding max attempts', () => {
    limiter.check('user@test.com')
    limiter.check('user@test.com')
    limiter.check('user@test.com')
    expect(limiter.check('user@test.com')).toBe(false)
  })

  it('tracks keys independently', () => {
    limiter.check('a@test.com')
    limiter.check('a@test.com')
    limiter.check('a@test.com')
    expect(limiter.check('a@test.com')).toBe(false)
    expect(limiter.check('b@test.com')).toBe(true)
  })

  it('resets after calling reset()', () => {
    limiter.check('user@test.com')
    limiter.check('user@test.com')
    limiter.check('user@test.com')
    expect(limiter.check('user@test.com')).toBe(false)
    limiter.reset('user@test.com')
    expect(limiter.check('user@test.com')).toBe(true)
  })

  it('remaining() returns attempts left', () => {
    expect(limiter.remaining('user@test.com')).toBe(3)
    limiter.check('user@test.com')
    expect(limiter.remaining('user@test.com')).toBe(2)
    limiter.check('user@test.com')
    expect(limiter.remaining('user@test.com')).toBe(1)
    limiter.check('user@test.com')
    expect(limiter.remaining('user@test.com')).toBe(0)
  })
})
