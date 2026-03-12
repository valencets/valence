import { describe, it, expect } from 'vitest'
import type { DailySummaryRow, InsertableDailySummary, DailySummaryPayload } from '../daily-summary-types.js'

describe('DailySummaryRow', () => {
  it('can be constructed with all fields', () => {
    const row: DailySummaryRow = {
      id: 1,
      site_id: 'site_acme_barbershop',
      date: new Date('2026-03-10'),
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
      synced_at: new Date('2026-03-10T12:00:00Z'),
      created_at: new Date('2026-03-10T06:00:00Z')
    }
    expect(row.id).toBe(1)
    expect(row.site_id).toBe('site_acme_barbershop')
    expect(row.business_type).toBe('barbershop')
    expect(row.schema_version).toBe(1)
  })

  it('allows null for optional numeric fields', () => {
    const row: DailySummaryRow = {
      id: 2,
      site_id: 'site_peak_legal',
      date: new Date('2026-03-10'),
      business_type: 'legal',
      schema_version: 1,
      session_count: null,
      pageview_count: null,
      conversion_count: null,
      top_referrers: null,
      top_pages: null,
      intent_counts: null,
      avg_flush_ms: null,
      rejection_count: null,
      synced_at: null,
      created_at: new Date()
    }
    expect(row.session_count).toBeNull()
    expect(row.synced_at).toBeNull()
    expect(row.top_referrers).toBeNull()
  })

  it('all fields are readonly', () => {
    const row: DailySummaryRow = {
      id: 3,
      site_id: 'test',
      date: new Date(),
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
    }
    expect(row.id).toBe(3)
    expect(row.site_id).toBe('test')
  })
})

describe('InsertableDailySummary', () => {
  it('omits id and created_at', () => {
    const summary: InsertableDailySummary = {
      site_id: 'site_acme_barbershop',
      date: new Date('2026-03-10'),
      business_type: 'barbershop',
      schema_version: 1,
      session_count: 247,
      pageview_count: 1200,
      conversion_count: 45,
      top_referrers: [{ referrer: 'google', count: 120 }],
      top_pages: [{ path: '/', count: 500 }],
      intent_counts: { CLICK: 800 },
      avg_flush_ms: 2.8,
      rejection_count: 5,
      synced_at: null
    }
    expect(summary.site_id).toBe('site_acme_barbershop')
    expect(summary).not.toHaveProperty('id')
    expect(summary).not.toHaveProperty('created_at')
  })

  it('allows null synced_at', () => {
    const summary: InsertableDailySummary = {
      site_id: 'test',
      date: new Date(),
      business_type: 'dental',
      schema_version: 1,
      session_count: 0,
      pageview_count: 0,
      conversion_count: 0,
      top_referrers: [],
      top_pages: [],
      intent_counts: {},
      avg_flush_ms: 0,
      rejection_count: 0,
      synced_at: null
    }
    expect(summary.synced_at).toBeNull()
  })
})

describe('DailySummaryPayload', () => {
  it('uses ISO string dates for wire format', () => {
    const payload: DailySummaryPayload = {
      site_id: 'site_acme_barbershop',
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
    expect(payload.date).toBe('2026-03-10')
    expect(typeof payload.date).toBe('string')
  })

  it('has string date instead of Date object', () => {
    const payload: DailySummaryPayload = {
      site_id: 'test',
      date: '2026-01-01',
      business_type: 'studio',
      schema_version: 1,
      session_count: 10,
      pageview_count: 50,
      conversion_count: 3,
      top_referrers: [],
      top_pages: [],
      intent_counts: {},
      avg_flush_ms: 1.0,
      rejection_count: 0
    }
    expect(typeof payload.date).toBe('string')
    expect(payload.schema_version).toBe(1)
  })
})
