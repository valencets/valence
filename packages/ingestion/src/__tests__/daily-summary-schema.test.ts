import { describe, it, expect } from 'vitest'
import { validateDailySummary } from '../daily-summary-schema.js'

function makePayload (overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    site_id: 'site_acme_barbershop',
    date: '2026-03-10',
    business_type: 'barbershop',
    schema_version: 1,
    session_count: 247,
    pageview_count: 1200,
    conversion_count: 45,
    top_referrers: [{ referrer: 'google', count: 120 }],
    top_pages: [{ path: '/', count: 500 }],
    intent_counts: { CLICK: 800, SCROLL: 1200 },
    avg_flush_ms: 2.8,
    rejection_count: 5,
    ...overrides
  }
}

describe('validateDailySummary', () => {
  describe('Ok — valid payloads', () => {
    it('validates a complete payload', () => {
      const result = validateDailySummary(makePayload())
      expect(result.isOk()).toBe(true)
      const data = result._unsafeUnwrap()
      expect(data.site_id).toBe('site_acme_barbershop')
      expect(data.date).toBe('2026-03-10')
      expect(data.schema_version).toBe(1)
    })

    it('validates with null optional fields', () => {
      const result = validateDailySummary(makePayload({
        session_count: null,
        pageview_count: null,
        conversion_count: null,
        top_referrers: null,
        top_pages: null,
        intent_counts: null,
        avg_flush_ms: null,
        rejection_count: null
      }))
      expect(result.isOk()).toBe(true)
    })

    it('validates with empty arrays for top_referrers and top_pages', () => {
      const result = validateDailySummary(makePayload({
        top_referrers: [],
        top_pages: []
      }))
      expect(result.isOk()).toBe(true)
    })

    it('validates with empty intent_counts object', () => {
      const result = validateDailySummary(makePayload({
        intent_counts: {}
      }))
      expect(result.isOk()).toBe(true)
    })

    it('validates with zero values', () => {
      const result = validateDailySummary(makePayload({
        session_count: 0,
        pageview_count: 0,
        conversion_count: 0,
        avg_flush_ms: 0,
        rejection_count: 0
      }))
      expect(result.isOk()).toBe(true)
    })

    it('validates multiple top_referrers up to 10', () => {
      const referrers = Array.from({ length: 10 }, (_, i) => ({
        referrer: `source-${i}`,
        count: 100 - i
      }))
      const result = validateDailySummary(makePayload({ top_referrers: referrers }))
      expect(result.isOk()).toBe(true)
    })

    it('validates multiple top_pages up to 10', () => {
      const pages = Array.from({ length: 10 }, (_, i) => ({
        path: `/page-${i}`,
        count: 100 - i
      }))
      const result = validateDailySummary(makePayload({ top_pages: pages }))
      expect(result.isOk()).toBe(true)
    })
  })

  describe('Err — invalid payloads', () => {
    it('rejects missing site_id', () => {
      const { site_id: _, ...noSiteId } = makePayload()
      const result = validateDailySummary(noSiteId)
      expect(result.isErr()).toBe(true)
    })

    it('rejects missing date', () => {
      const { date: _, ...noDate } = makePayload()
      const result = validateDailySummary(noDate)
      expect(result.isErr()).toBe(true)
    })

    it('rejects missing business_type', () => {
      const { business_type: _, ...noType } = makePayload()
      const result = validateDailySummary(noType)
      expect(result.isErr()).toBe(true)
    })

    it('rejects wrong schema_version', () => {
      const result = validateDailySummary(makePayload({ schema_version: 2 }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects missing schema_version', () => {
      const { schema_version: _, ...noVersion } = makePayload()
      const result = validateDailySummary(noVersion)
      expect(result.isErr()).toBe(true)
    })

    it('rejects non-integer session_count', () => {
      const result = validateDailySummary(makePayload({ session_count: 1.5 }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects non-integer pageview_count', () => {
      const result = validateDailySummary(makePayload({ pageview_count: 1.5 }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects non-integer conversion_count', () => {
      const result = validateDailySummary(makePayload({ conversion_count: 1.5 }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects non-integer rejection_count', () => {
      const result = validateDailySummary(makePayload({ rejection_count: 1.5 }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects more than 10 top_referrers', () => {
      const referrers = Array.from({ length: 11 }, (_, i) => ({
        referrer: `source-${i}`,
        count: i
      }))
      const result = validateDailySummary(makePayload({ top_referrers: referrers }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects more than 10 top_pages', () => {
      const pages = Array.from({ length: 11 }, (_, i) => ({
        path: `/page-${i}`,
        count: i
      }))
      const result = validateDailySummary(makePayload({ top_pages: pages }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects non-integer intent_counts values', () => {
      const result = validateDailySummary(makePayload({ intent_counts: { CLICK: 1.5 } }))
      expect(result.isErr()).toBe(true)
    })

    it('rejects null', () => {
      const result = validateDailySummary(null)
      expect(result.isErr()).toBe(true)
    })

    it('rejects a string', () => {
      const result = validateDailySummary('not an object')
      expect(result.isErr()).toBe(true)
    })

    it('rejects an array', () => {
      const result = validateDailySummary([makePayload()])
      expect(result.isErr()).toBe(true)
    })
  })

  describe('contract — error shape', () => {
    it('error has code VALIDATION_FAILURE', () => {
      const result = validateDailySummary('bad')
      expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_FAILURE')
    })

    it('error has non-empty issues array', () => {
      const result = validateDailySummary({})
      const failure = result._unsafeUnwrapErr()
      expect(failure.issues.length).toBeGreaterThan(0)
    })

    it('each issue has path and message', () => {
      const result = validateDailySummary({ schema_version: 2 })
      const failure = result._unsafeUnwrapErr()
      const issue = failure.issues[0]
      expect(issue).toHaveProperty('path')
      expect(issue).toHaveProperty('message')
      expect(typeof issue?.path).toBe('string')
      expect(typeof issue?.message).toBe('string')
    })
  })
})
