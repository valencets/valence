import { describe, it, expect, vi } from 'vitest'
import { getDailySummary, getUnsyncedDailySummaries, markSynced, insertDailySummaryFromRemote, getDailyBreakdowns, getDailyTrend } from '../daily-summary-queries.js'
import type { DbPool } from '@valencets/db'
import { makeMockPool, makeErrorPool } from './test-helpers.js'

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
    expect(result.unwrap()).toBeNull()
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
    expect(result.unwrap()).toEqual([])
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

describe('getDailyBreakdowns', () => {
  it('is a function', () => {
    expect(typeof getDailyBreakdowns).toBe('function')
  })

  it('returns breakdowns with top_pages, top_referrers, and intent_counts', async () => {
    const pool = makeMockPool([mockRow])
    const result = await getDailyBreakdowns(pool, 'site_acme', new Date('2026-03-10'), new Date('2026-03-11'))
    expect(result.isOk()).toBe(true)
    const data = result.unwrap()
    expect(data.top_pages).toBeDefined()
    expect(data.top_referrers).toBeDefined()
    expect(data.intent_counts).toBeDefined()
  })

  it('returns empty breakdowns when no data', async () => {
    const pool = makeMockPool([])
    const result = await getDailyBreakdowns(pool, 'site_acme', new Date('2026-03-10'), new Date('2026-03-11'))
    expect(result.isOk()).toBe(true)
    const data = result.unwrap()
    expect(data.top_pages).toEqual([])
    expect(data.top_referrers).toEqual([])
    expect(data.intent_counts).toEqual({})
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getDailyBreakdowns(pool, 'site_acme', new Date('2026-03-10'), new Date('2026-03-11'))
    expect(result.isErr()).toBe(true)
  })

  it('uses inclusive end date to include today in results', async () => {
    const sqlCalls: string[] = []
    const sql = vi.fn((strings: TemplateStringsArray) => {
      sqlCalls.push(strings.join(''))
      return Promise.resolve([])
    }) as unknown as DbPool['sql']
    const pool: DbPool = { sql }

    await getDailyBreakdowns(pool, 'site_acme', new Date('2026-03-10'), new Date('2026-03-12'))

    // The query should use <= for end date, not <
    const query = sqlCalls[0] ?? ''
    expect(query).toContain('date <=')
    expect(query).not.toMatch(/date\s*<\s*\$/)
  })
})

describe('getDailyTrend', () => {
  it('is a function', () => {
    expect(typeof getDailyTrend).toBe('function')
  })

  it('returns empty array for no matching rows', async () => {
    const pool = makeMockPool([])
    const result = await getDailyTrend(pool, 'site_acme', new Date('2026-03-01'), new Date('2026-03-07'))
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual([])
  })

  it('returns rows ordered by date ASC', async () => {
    const rows = [
      { ...mockRow, date: new Date('2026-03-01'), session_count: 10 },
      { ...mockRow, date: new Date('2026-03-02'), session_count: 20 }
    ]
    const pool = makeMockPool(rows)
    const result = await getDailyTrend(pool, 'site_acme', new Date('2026-03-01'), new Date('2026-03-02'))
    expect(result.isOk()).toBe(true)
    const data = result.unwrap()
    expect(data).toHaveLength(2)
  })

  it('returns session_count, pageview_count, conversion_count per row', async () => {
    const pool = makeMockPool([mockRow])
    const result = await getDailyTrend(pool, 'site_acme', new Date('2026-03-10'), new Date('2026-03-10'))
    expect(result.isOk()).toBe(true)
    const data = result.unwrap()
    expect(data[0].session_count).toBe(247)
    expect(data[0].pageview_count).toBe(1200)
    expect(data[0].conversion_count).toBe(45)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getDailyTrend(pool, 'site_acme', new Date('2026-03-01'), new Date('2026-03-07'))
    expect(result.isErr()).toBe(true)
  })
})
