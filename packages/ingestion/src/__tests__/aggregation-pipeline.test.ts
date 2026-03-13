import { describe, it, expect, vi } from 'vitest'
import { createAggregationPipeline } from '../aggregation-pipeline.js'
import { signPayload } from '../hmac.js'
import { ok, err } from '@inertia/neverthrow'

function makePayload (): Record<string, unknown> {
  return {
    site_id: 'site_acme',
    date: '2026-03-10',
    business_type: 'barbershop',
    schema_version: 1,
    session_count: 247,
    pageview_count: 1200,
    conversion_count: 45,
    top_referrers: [{ referrer: 'google', count: 120 }],
    top_pages: [{ path: '/', count: 500 }],
    intent_counts: { CLICK: 800 },
    avg_flush_ms: 2.8,
    rejection_count: 5
  }
}

describe('createAggregationPipeline', () => {
  it('is a function', () => {
    expect(typeof createAggregationPipeline).toBe('function')
  })

  it('returns a handler function', () => {
    const pipeline = createAggregationPipeline(
      (_s, _b, _sig) => ok(true),
      (_p) => ok(1)
    )
    expect(typeof pipeline).toBe('function')
  })

  it('returns 200 OK on valid signed payload', () => {
    const secret = 'test-secret'
    const body = JSON.stringify(makePayload())
    const sig = signPayload(secret, body)

    const verifyFn = (s: string, b: string, signature: string) => {
      return signPayload(s, b) === signature ? ok(true as const) : err({ code: 'INVALID_SIGNATURE' as const, message: 'bad' })
    }
    const persistFn = vi.fn(() => ok(1))

    const pipeline = createAggregationPipeline(
      (_s, b, signature) => verifyFn(secret, b, signature),
      persistFn
    )

    const result = pipeline(body, sig)
    expect(result.isOk()).toBe(true)
    expect(persistFn).toHaveBeenCalled()
  })

  it('returns 200 OK even on invalid signature (Black Hole)', () => {
    const verifyFn = vi.fn(() => err({ code: 'INVALID_SIGNATURE' as const, message: 'bad' }))
    const persistFn = vi.fn(() => ok(1))

    const pipeline = createAggregationPipeline(verifyFn, persistFn)
    const result = pipeline('{}', 'bad-sig')

    // Black Hole: always returns ok
    expect(result.isOk()).toBe(true)
    expect(persistFn).not.toHaveBeenCalled()
  })

  it('returns 200 OK on malformed JSON (Black Hole)', () => {
    const verifyFn = vi.fn(() => ok(true as const))
    const persistFn = vi.fn(() => ok(1))

    const pipeline = createAggregationPipeline(verifyFn, persistFn)
    const result = pipeline('not-json', 'some-sig')

    expect(result.isOk()).toBe(true)
    expect(persistFn).not.toHaveBeenCalled()
  })

  it('returns 200 OK on invalid schema (Black Hole)', () => {
    const verifyFn = vi.fn(() => ok(true as const))
    const persistFn = vi.fn(() => ok(1))

    const pipeline = createAggregationPipeline(verifyFn, persistFn)
    const result = pipeline(JSON.stringify({ bad: 'data' }), 'some-sig')

    expect(result.isOk()).toBe(true)
    expect(persistFn).not.toHaveBeenCalled()
  })

  it('calls audit on failure', () => {
    const auditEntries: Array<{ code: string }> = []
    const verifyFn = vi.fn(() => ok(true as const))
    const persistFn = vi.fn(() => ok(1))
    const auditFn = vi.fn((entry: { code: string }) => { auditEntries.push(entry) })

    const pipeline = createAggregationPipeline(verifyFn, persistFn, auditFn)
    pipeline(JSON.stringify({ bad: 'data' }), 'some-sig')

    expect(auditFn).toHaveBeenCalled()
    expect(auditEntries[0]?.code).toBe('VALIDATION_FAILURE')
  })
})
