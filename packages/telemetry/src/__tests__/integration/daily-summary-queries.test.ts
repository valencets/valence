import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import type { JSONValue } from 'postgres'
import { setupTestDatabase, teardownTestDatabase, getAppPool } from './setup.js'
import {
  getDailySummary,
  getUnsyncedDailySummaries,
  markSynced,
  insertDailySummaryFromRemote,
  getDailyTrend,
  getDailyBreakdowns
} from '../../daily-summary-queries.js'
import type { DailySummaryPayload } from '../../daily-summary-types.js'
import type { DbPool } from '@valencets/db'

let pool: DbPool

beforeAll(async () => {
  await setupTestDatabase()
  pool = getAppPool()
})

afterAll(async () => {
  await teardownTestDatabase()
})

beforeEach(async () => {
  await pool.sql`DELETE FROM daily_summaries`
})

const siteId = 'test-site'

async function insertSummary (opts: {
  siteId?: string
  date: Date
  sessionCount?: number
  pageviewCount?: number
  conversionCount?: number
  syncedAt?: Date | null
  topPages?: ReadonlyArray<{ path: string; count: number }>
  topReferrers?: ReadonlyArray<{ referrer: string; count: number }>
  intentCounts?: Record<string, number>
}): Promise<number> {
  const rows = await pool.sql<Array<{ id: number }>>`
    INSERT INTO daily_summaries (
      site_id, date, business_type, schema_version,
      session_count, pageview_count, conversion_count,
      top_referrers, top_pages, intent_counts,
      avg_flush_ms, rejection_count, synced_at
    )
    VALUES (
      ${opts.siteId ?? siteId}, ${opts.date}, 'dental', 1,
      ${opts.sessionCount ?? 0}, ${opts.pageviewCount ?? 0}, ${opts.conversionCount ?? 0},
      ${pool.sql.json((opts.topReferrers ?? []) as unknown as JSONValue)},
      ${pool.sql.json((opts.topPages ?? []) as unknown as JSONValue)},
      ${pool.sql.json((opts.intentCounts ?? {}) as unknown as JSONValue)},
      0, 0, ${opts.syncedAt === undefined ? null : opts.syncedAt}
    )
    RETURNING id
  `
  return rows[0]!.id
}

describe('getDailySummary', () => {
  it('returns null for nonexistent site+date', async () => {
    const result = await getDailySummary(pool, 'no-site', new Date('2026-01-01'))
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('returns the row when it exists', async () => {
    const date = new Date('2026-03-15')
    await insertSummary({ date, sessionCount: 42 })

    const result = await getDailySummary(pool, siteId, date)
    expect(result.isOk()).toBe(true)

    const row = result._unsafeUnwrap()
    expect(row).not.toBeNull()
    expect(row!.session_count).toBe(42)
    expect(row!.site_id).toBe(siteId)
  })
})

describe('getUnsyncedDailySummaries', () => {
  it('only returns rows where synced_at IS NULL', async () => {
    await insertSummary({ date: new Date('2026-03-10'), syncedAt: null })
    await insertSummary({ date: new Date('2026-03-11'), syncedAt: null })
    await insertSummary({ date: new Date('2026-03-12'), syncedAt: new Date() })

    const result = await getUnsyncedDailySummaries(pool, siteId)
    expect(result.isOk()).toBe(true)

    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(2)
    for (const row of rows) {
      expect(row.synced_at).toBeNull()
    }
  })

  it('returns results ordered by date ASC', async () => {
    await insertSummary({ date: new Date('2026-03-15'), syncedAt: null })
    await insertSummary({ date: new Date('2026-03-10'), syncedAt: null })
    await insertSummary({ date: new Date('2026-03-12'), syncedAt: null })

    const result = await getUnsyncedDailySummaries(pool, siteId)
    const rows = result._unsafeUnwrap()
    const dates = rows.map((r) => new Date(r.date).getTime())
    expect(dates).toEqual([...dates].sort((a, b) => a - b))
  })
})

describe('markSynced', () => {
  it('sets synced_at to non-null', async () => {
    const date = new Date('2026-03-15')
    const id = await insertSummary({ date, syncedAt: null })

    const markResult = await markSynced(pool, id)
    expect(markResult.isOk()).toBe(true)

    const checkResult = await getDailySummary(pool, siteId, date)
    const row = checkResult._unsafeUnwrap()
    expect(row!.synced_at).not.toBeNull()
  })
})

describe('insertDailySummaryFromRemote', () => {
  it('round-trips a remote summary payload', async () => {
    const payload: DailySummaryPayload = {
      site_id: 'remote-site',
      date: '2026-03-15',
      business_type: 'plumbing',
      schema_version: 1,
      session_count: 100,
      pageview_count: 500,
      conversion_count: 10,
      top_referrers: [{ referrer: 'google.com', count: 50 }],
      top_pages: [{ path: '/home', count: 200 }],
      intent_counts: { INTENT_CALL: 5, LEAD_FORM: 5 },
      avg_flush_ms: 15.2,
      rejection_count: 3
    }

    const result = await insertDailySummaryFromRemote(pool, payload)
    expect(result.isOk()).toBe(true)

    const row = result._unsafeUnwrap()
    expect(row.site_id).toBe('remote-site')
    expect(row.session_count).toBe(100)
    expect(row.pageview_count).toBe(500)
    expect(row.top_referrers).toEqual([{ referrer: 'google.com', count: 50 }])
    expect(row.top_pages).toEqual([{ path: '/home', count: 200 }])
    expect(row.intent_counts).toEqual({ INTENT_CALL: 5, LEAD_FORM: 5 })
  })

  it('upserts on same site_id + date', async () => {
    const payload: DailySummaryPayload = {
      site_id: 'upsert-site',
      date: '2026-03-15',
      business_type: 'dental',
      schema_version: 1,
      session_count: 10,
      pageview_count: 50,
      conversion_count: 1,
      top_referrers: [],
      top_pages: [],
      intent_counts: {},
      avg_flush_ms: 5,
      rejection_count: 0
    }

    await insertDailySummaryFromRemote(pool, payload)
    const updated = { ...payload, session_count: 20 }
    const result = await insertDailySummaryFromRemote(pool, updated)
    expect(result._unsafeUnwrap().session_count).toBe(20)

    const rows = await pool.sql`
      SELECT * FROM daily_summaries WHERE site_id = 'upsert-site'
    `
    expect(rows.length).toBe(1)
  })
})

describe('getDailyTrend', () => {
  it('returns rows ordered by date ASC within range', async () => {
    await insertSummary({ date: new Date('2026-03-10'), sessionCount: 10 })
    await insertSummary({ date: new Date('2026-03-12'), sessionCount: 30 })
    await insertSummary({ date: new Date('2026-03-11'), sessionCount: 20 })
    await insertSummary({ date: new Date('2026-03-15'), sessionCount: 50 }) // outside range

    const result = await getDailyTrend(pool, siteId, new Date('2026-03-10'), new Date('2026-03-12'))
    expect(result.isOk()).toBe(true)

    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(3)
    expect(rows[0]!.session_count).toBe(10)
    expect(rows[1]!.session_count).toBe(20)
    expect(rows[2]!.session_count).toBe(30)
  })

  it('returns empty for range with no data', async () => {
    const result = await getDailyTrend(pool, siteId, new Date('2026-01-01'), new Date('2026-01-31'))
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })
})

describe('getDailyBreakdowns', () => {
  it('merges breakdowns across multiple days', async () => {
    await insertSummary({
      date: new Date('2026-03-10'),
      topPages: [{ path: '/home', count: 10 }, { path: '/about', count: 5 }],
      topReferrers: [{ referrer: 'google.com', count: 8 }],
      intentCounts: { INTENT_CALL: 3 }
    })
    await insertSummary({
      date: new Date('2026-03-11'),
      topPages: [{ path: '/home', count: 15 }, { path: '/contact', count: 7 }],
      topReferrers: [{ referrer: 'google.com', count: 12 }, { referrer: 'bing.com', count: 4 }],
      intentCounts: { INTENT_CALL: 2, LEAD_FORM: 5 }
    })

    const result = await getDailyBreakdowns(pool, siteId, new Date('2026-03-10'), new Date('2026-03-11'))
    expect(result.isOk()).toBe(true)

    const breakdowns = result._unsafeUnwrap()

    // Pages merged
    const homePage = breakdowns.top_pages.find((p) => p.path === '/home')
    expect(homePage).toBeDefined()
    expect(homePage!.count).toBe(25) // 10 + 15

    // Referrers merged
    const google = breakdowns.top_referrers.find((r) => r.referrer === 'google.com')
    expect(google).toBeDefined()
    expect(google!.count).toBe(20) // 8 + 12

    // Intent counts merged
    expect(breakdowns.intent_counts['INTENT_CALL']).toBe(5) // 3 + 2
    expect(breakdowns.intent_counts['LEAD_FORM']).toBe(5)
  })

  it('returns empty breakdowns when no data exists', async () => {
    const result = await getDailyBreakdowns(pool, siteId, new Date('2026-01-01'), new Date('2026-01-31'))
    expect(result.isOk()).toBe(true)

    const breakdowns = result._unsafeUnwrap()
    expect(breakdowns.top_pages).toHaveLength(0)
    expect(breakdowns.top_referrers).toHaveLength(0)
    expect(breakdowns.intent_counts).toEqual({})
  })
})
