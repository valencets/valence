import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, teardownTestDatabase, getAppPool } from './setup.js'
import {
  aggregateSessionSummary,
  aggregateEventSummary,
  aggregateConversionSummary
} from '../../aggregation.js'
import type { SummaryPeriod } from '../../summary-types.js'
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
  await pool.sql`DELETE FROM events`
  await pool.sql`DELETE FROM sessions`
  await pool.sql`DELETE FROM session_summaries`
  await pool.sql`DELETE FROM event_summaries`
  await pool.sql`DELETE FROM conversion_summaries`
})

const period: SummaryPeriod = {
  start: new Date('2026-03-01T00:00:00Z'),
  end: new Date('2026-03-02T00:00:00Z')
}

async function seedSession (
  deviceType: string,
  referrer: string | null,
  createdAt: Date
): Promise<string> {
  const rows = await pool.sql<Array<{ session_id: string }>>`
    INSERT INTO sessions (device_type, referrer, created_at)
    VALUES (${deviceType}, ${referrer}, ${createdAt})
    RETURNING session_id
  `
  return rows[0]!.session_id
}

async function seedEvent (
  sessionId: string,
  category: string,
  createdAt: Date,
  payload: Record<string, string> = {}
): Promise<void> {
  await pool.sql`
    INSERT INTO events (session_id, event_category, created_at, payload)
    VALUES (${sessionId}, ${category}, ${createdAt}, ${JSON.stringify(payload)})
  `
}

describe('aggregateSessionSummary', () => {
  it('counts sessions with correct device breakdown', async () => {
    const ts = new Date('2026-03-01T12:00:00Z')
    await seedSession('mobile', 'google.com', ts)
    await seedSession('mobile', 'bing.com', ts)
    await seedSession('desktop', 'google.com', ts)
    await seedSession('tablet', null, ts)

    const result = await aggregateSessionSummary(pool, period)
    expect(result.isOk()).toBe(true)

    const row = result._unsafeUnwrap()
    expect(row.total_sessions).toBe(4)
    expect(row.unique_referrers).toBe(3) // google.com, bing.com, NULL
    expect(row.device_mobile).toBe(2)
    expect(row.device_desktop).toBe(1)
    expect(row.device_tablet).toBe(1)
  })

  it('returns zero counts for empty period', async () => {
    const result = await aggregateSessionSummary(pool, period)
    expect(result.isOk()).toBe(true)

    const row = result._unsafeUnwrap()
    expect(row.total_sessions).toBe(0)
    expect(row.device_mobile).toBe(0)
    expect(row.device_desktop).toBe(0)
    expect(row.device_tablet).toBe(0)
  })

  it('upserts on same period — updates instead of duplicating', async () => {
    const ts = new Date('2026-03-01T12:00:00Z')
    await seedSession('mobile', null, ts)

    const first = await aggregateSessionSummary(pool, period)
    expect(first._unsafeUnwrap().total_sessions).toBe(1)

    await seedSession('desktop', null, ts)

    const second = await aggregateSessionSummary(pool, period)
    expect(second._unsafeUnwrap().total_sessions).toBe(2)

    // Verify only one row exists for this period
    const rows = await pool.sql`
      SELECT * FROM session_summaries
      WHERE period_start = ${period.start} AND period_end = ${period.end}
    `
    expect(rows.length).toBe(1)
  })

  it('excludes sessions outside period', async () => {
    const inside = new Date('2026-03-01T12:00:00Z')
    const outside = new Date('2026-03-02T12:00:00Z')
    await seedSession('mobile', null, inside)
    await seedSession('desktop', null, outside)

    const result = await aggregateSessionSummary(pool, period)
    expect(result._unsafeUnwrap().total_sessions).toBe(1)
  })
})

describe('aggregateEventSummary', () => {
  it('groups events by category with unique session counts', async () => {
    const ts = new Date('2026-03-01T12:00:00Z')
    const s1 = await seedSession('mobile', null, ts)
    const s2 = await seedSession('desktop', null, ts)

    await seedEvent(s1, 'CLICK', ts)
    await seedEvent(s1, 'CLICK', ts)
    await seedEvent(s2, 'CLICK', ts)
    await seedEvent(s1, 'VIEWPORT_INTERSECT', ts)

    const result = await aggregateEventSummary(pool, period)
    expect(result.isOk()).toBe(true)

    const rows = result._unsafeUnwrap()
    const click = rows.find((r) => r.event_category === 'CLICK')
    const viewport = rows.find((r) => r.event_category === 'VIEWPORT_INTERSECT')

    expect(click).toBeDefined()
    expect(click!.total_count).toBe(3)
    expect(click!.unique_sessions).toBe(2)

    expect(viewport).toBeDefined()
    expect(viewport!.total_count).toBe(1)
    expect(viewport!.unique_sessions).toBe(1)
  })

  it('returns empty array for period with no events', async () => {
    const result = await aggregateEventSummary(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })

  it('upserts event summaries on same period + category', async () => {
    const ts = new Date('2026-03-01T12:00:00Z')
    const s1 = await seedSession('mobile', null, ts)
    await seedEvent(s1, 'CLICK', ts)

    await aggregateEventSummary(pool, period)

    await seedEvent(s1, 'CLICK', ts)
    await aggregateEventSummary(pool, period)

    const rows = await pool.sql`
      SELECT * FROM event_summaries
      WHERE period_start = ${period.start} AND period_end = ${period.end}
        AND event_category = 'CLICK'
    `
    expect(rows.length).toBe(1)
    expect(rows[0]!.total_count).toBe(2)
  })
})

describe('aggregateConversionSummary', () => {
  it('aggregates conversion events with top sources', async () => {
    const ts = new Date('2026-03-01T12:00:00Z')
    const s1 = await seedSession('mobile', 'google.com', ts)
    const s2 = await seedSession('desktop', 'bing.com', ts)

    await seedEvent(s1, 'INTENT_CALL', ts)
    await seedEvent(s2, 'INTENT_CALL', ts)
    await seedEvent(s1, 'LEAD_EMAIL', ts)

    const result = await aggregateConversionSummary(pool, period)
    expect(result.isOk()).toBe(true)

    const rows = result._unsafeUnwrap()
    const callRow = rows.find((r) => r.intent_type === 'INTENT_CALL')
    expect(callRow).toBeDefined()
    expect(callRow!.total_count).toBe(2)
    expect(Array.isArray(callRow!.top_sources)).toBe(true)
  })

  it('returns empty array when no conversion events exist', async () => {
    const ts = new Date('2026-03-01T12:00:00Z')
    const s1 = await seedSession('mobile', null, ts)
    await seedEvent(s1, 'CLICK', ts) // Not a conversion event

    const result = await aggregateConversionSummary(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })

  it('upserts conversion summaries on same period + intent_type', async () => {
    const ts = new Date('2026-03-01T12:00:00Z')
    const s1 = await seedSession('mobile', 'google.com', ts)
    await seedEvent(s1, 'LEAD_FORM', ts)

    await aggregateConversionSummary(pool, period)

    await seedEvent(s1, 'LEAD_FORM', ts)
    await aggregateConversionSummary(pool, period)

    const rows = await pool.sql`
      SELECT * FROM conversion_summaries
      WHERE period_start = ${period.start} AND period_end = ${period.end}
        AND intent_type = 'LEAD_FORM'
    `
    expect(rows.length).toBe(1)
    expect(rows[0]!.total_count).toBe(2)
  })
})
