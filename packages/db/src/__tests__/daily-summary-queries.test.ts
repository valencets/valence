import { describe, it, expect, vi } from 'vitest'
import { getDailySummary, getUnsyncedDailySummaries, markSynced, insertDailySummaryFromRemote } from '../daily-summary-queries.js'
import type { DbPool } from '../connection.js'

function makeMockPool (returnValue: unknown = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

function makeErrorPool (error: Error): DbPool {
  const sql = vi.fn(() => Promise.reject(error)) as unknown as DbPool['sql']
  return { sql }
}

const mockRow = {
  id: 1,
  site_id: 'site_acme',
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
  synced_at: null,
  created_at: new Date()
}

describe('getDailySummary', () => {
  it('is a function', () => {
    expect(typeof getDailySummary).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeMockPool([mockRow])
    const result = getDailySummary(pool, 'site_acme', new Date('2026-03-10'))
    expect(typeof result.andThen).toBe('function')
  })

  it('returns null for no data', async () => {
    const pool = makeMockPool([])
    const result = await getDailySummary(pool, 'site_acme', new Date('2026-03-10'))
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getDailySummary(pool, 'site_acme', new Date('2026-03-10'))
    expect(result.isErr()).toBe(true)
  })
})

describe('getUnsyncedDailySummaries', () => {
  it('is a function', () => {
    expect(typeof getUnsyncedDailySummaries).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getUnsyncedDailySummaries(pool, 'site_acme')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getUnsyncedDailySummaries(pool, 'site_acme')
    expect(result.isErr()).toBe(true)
  })
})

describe('markSynced', () => {
  it('is a function', () => {
    expect(typeof markSynced).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeMockPool()
    const result = markSynced(pool, 1)
    expect(typeof result.andThen).toBe('function')
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await markSynced(pool, 1)
    expect(result.isErr()).toBe(true)
  })
})

describe('insertDailySummaryFromRemote', () => {
  it('is a function', () => {
    expect(typeof insertDailySummaryFromRemote).toBe('function')
  })

  it('returns error on empty result', async () => {
    const pool = makeMockPool([])
    const result = await insertDailySummaryFromRemote(pool, {
      site_id: 'site_acme',
      date: '2026-03-10',
      business_type: 'barbershop',
      schema_version: 1,
      session_count: 247,
      pageview_count: 1200,
      conversion_count: 45,
      top_referrers: [],
      top_pages: [],
      intent_counts: {},
      avg_flush_ms: 2.8,
      rejection_count: 5
    })
    expect(result.isErr()).toBe(true)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await insertDailySummaryFromRemote(pool, {
      site_id: 'site_acme',
      date: '2026-03-10',
      business_type: 'barbershop',
      schema_version: 1,
      session_count: 247,
      pageview_count: 1200,
      conversion_count: 45,
      top_referrers: [],
      top_pages: [],
      intent_counts: {},
      avg_flush_ms: 2.8,
      rejection_count: 5
    })
    expect(result.isErr()).toBe(true)
  })
})
