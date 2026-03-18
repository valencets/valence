import { describe, it, expect, vi } from 'vitest'
import { generateDailySummary } from '../daily-summary-aggregation.js'
import type { DbPool } from '@valencets/db'
import { makeSequentialMockPool, makeErrorPool } from './test-helpers.js'

describe('generateDailySummary', () => {
  it('is a function', () => {
    expect(typeof generateDailySummary).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeSequentialMockPool({
      sessions: [{ total_sessions: 10 }],
      pageviews: [{ pageview_count: 50 }],
      conversions: [{ conversion_count: 3 }],
      referrers: [],
      pages: [],
      intents: [],
      health: [{ avg_flush_ms: 1.5, rejection_count: 0 }],
      upsert: [{
        id: 1,
        site_id: 'studio',
        date: new Date('2026-03-10'),
        business_type: 'studio',
        schema_version: 1,
        session_count: 10,
        pageview_count: 50,
        conversion_count: 3,
        top_referrers: [],
        top_pages: [],
        intent_counts: {},
        avg_flush_ms: 1.5,
        rejection_count: 0,
        synced_at: null,
        created_at: new Date()
      }]
    })
    const result = generateDailySummary(pool, 'studio', 'studio', new Date('2026-03-10'))
    expect(typeof result.andThen).toBe('function')
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await generateDailySummary(pool, 'studio', 'studio', new Date('2026-03-10'))
    expect(result.isErr()).toBe(true)
  })

  it('accepts siteId, businessType, and date parameters', () => {
    const pool = makeSequentialMockPool({
      q1: [{ total_sessions: 0 }],
      q2: [{ pageview_count: 0 }],
      q3: [{ conversion_count: 0 }],
      q4: [],
      q5: [],
      q6: [],
      q7: [{ avg_flush_ms: 0, rejection_count: 0 }],
      q8: [{
        id: 1,
        site_id: 'site_acme',
        date: new Date('2026-03-10'),
        business_type: 'barbershop',
        schema_version: 1,
        session_count: 0,
        pageview_count: 0,
        conversion_count: 0,
        top_referrers: [],
        top_pages: [],
        intent_counts: {},
        avg_flush_ms: 0,
        rejection_count: 0,
        synced_at: null,
        created_at: new Date()
      }]
    })
    const result = generateDailySummary(pool, 'site_acme', 'barbershop', new Date('2026-03-10'))
    expect(typeof result.andThen).toBe('function')
  })

  it('uses sql.json() for JSONB columns to prevent double-encoding', async () => {
    const responses = [
      [{ total_sessions: 5 }],
      [{ pageview_count: 20 }],
      [{ conversion_count: 1 }],
      [{ referrer: 'google.com', count: 3 }],
      [{ path: '/', count: 10 }],
      [{ event_category: 'CLICK', count: 15 }],
      [{ avg_flush_ms: 1.0, rejection_count: 0 }],
      [{
        id: 1,
        site_id: 'studio',
        date: new Date('2026-03-10'),
        business_type: 'studio',
        schema_version: 1,
        session_count: 5,
        pageview_count: 20,
        conversion_count: 1,
        top_referrers: [{ referrer: 'google.com', count: 3 }],
        top_pages: [{ path: '/', count: 10 }],
        intent_counts: { CLICK: 15 },
        avg_flush_ms: 1.0,
        rejection_count: 0,
        synced_at: null,
        created_at: new Date()
      }]
    ]
    let callIdx = 0
    const jsonFn = vi.fn((val: unknown) => ({ _json: val }))
    const sql = vi.fn(() => {
      const result = responses[callIdx] ?? []
      callIdx++
      return Promise.resolve(result)
    }) as unknown as DbPool['sql']
    Object.defineProperty(sql, 'json', { value: jsonFn })
    const pool: DbPool = { sql }

    await generateDailySummary(pool, 'studio', 'studio', new Date('2026-03-10'))

    // sql.json() should have been called for the 3 JSONB columns
    expect(jsonFn).toHaveBeenCalled()
    expect(jsonFn.mock.calls.length).toBe(3)
  })

  it('includes null referrers as empty string for direct traffic classification', async () => {
    const sqlCalls: string[] = []
    const responses = [
      [{ total_sessions: 10 }],
      [{ pageview_count: 50 }],
      [{ conversion_count: 3 }],
      [{ referrer: '', count: 5 }], // direct traffic from COALESCE(referrer, '')
      [{ path: '/', count: 100 }],
      [{ event_category: 'CLICK', count: 80 }],
      [{ avg_flush_ms: 1.5, rejection_count: 0 }],
      [{
        id: 1,
        site_id: 'studio',
        date: new Date('2026-03-10'),
        business_type: 'studio',
        schema_version: 1,
        session_count: 10,
        pageview_count: 50,
        conversion_count: 3,
        top_referrers: [{ referrer: '', count: 5 }],
        top_pages: [{ path: '/', count: 100 }],
        intent_counts: { CLICK: 80 },
        avg_flush_ms: 1.5,
        rejection_count: 0,
        synced_at: null,
        created_at: new Date()
      }]
    ]
    let callIdx = 0
    const sql = vi.fn((strings: TemplateStringsArray) => {
      sqlCalls.push(strings.join(''))
      const result = responses[callIdx] ?? []
      callIdx++
      return Promise.resolve(result)
    }) as unknown as DbPool['sql']
    Object.defineProperty(sql, 'json', { value: (v: unknown) => v })
    const pool: DbPool = { sql }

    const result = await generateDailySummary(pool, 'studio', 'studio', new Date('2026-03-10'))
    expect(result.isOk()).toBe(true)

    // The referrer query (4th call) should NOT contain 'IS NOT NULL'
    const referrerQuery = sqlCalls[3] ?? ''
    expect(referrerQuery).not.toContain('IS NOT NULL')
  })
})
