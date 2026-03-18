import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, teardownTestDatabase, getAppPool } from './setup.js'
import {
  getSessionSummaries,
  getEventSummaries,
  getConversionSummaries,
  getIngestionHealth,
  insertIngestionHealth
} from '../../summary-queries.js'
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
  await pool.sql`DELETE FROM session_summaries`
  await pool.sql`DELETE FROM event_summaries`
  await pool.sql`DELETE FROM conversion_summaries`
  await pool.sql`DELETE FROM ingestion_health`
})

const period: SummaryPeriod = {
  start: new Date('2026-03-01T00:00:00Z'),
  end: new Date('2026-03-02T00:00:00Z')
}

describe('getSessionSummaries', () => {
  it('returns empty array when no summaries exist', async () => {
    const result = await getSessionSummaries(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })

  it('returns summaries within period', async () => {
    await pool.sql`
      INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
      VALUES (${period.start}, ${period.end}, 10, 3, 5, 4, 1)
    `

    const result = await getSessionSummaries(pool, period)
    expect(result.isOk()).toBe(true)

    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.total_sessions).toBe(10)
    expect(rows[0]!.unique_referrers).toBe(3)
    expect(rows[0]!.device_mobile).toBe(5)
  })

  it('excludes summaries outside period', async () => {
    const outsidePeriod = {
      start: new Date('2026-03-05T00:00:00Z'),
      end: new Date('2026-03-06T00:00:00Z')
    }
    await pool.sql`
      INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
      VALUES (${outsidePeriod.start}, ${outsidePeriod.end}, 10, 3, 5, 4, 1)
    `

    const result = await getSessionSummaries(pool, period)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })
})

describe('getEventSummaries', () => {
  it('returns empty array when no summaries exist', async () => {
    const result = await getEventSummaries(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })

  it('returns event summaries within period', async () => {
    await pool.sql`
      INSERT INTO event_summaries (period_start, period_end, event_category, total_count, unique_sessions)
      VALUES (${period.start}, ${period.end}, 'CLICK', 50, 20)
    `

    const result = await getEventSummaries(pool, period)
    expect(result.isOk()).toBe(true)

    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.event_category).toBe('CLICK')
    expect(rows[0]!.total_count).toBe(50)
    expect(rows[0]!.unique_sessions).toBe(20)
  })
})

describe('getConversionSummaries', () => {
  it('returns empty array when no summaries exist', async () => {
    const result = await getConversionSummaries(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })

  it('returns conversion summaries with top_sources JSON', async () => {
    const topSources = JSON.stringify([{ referrer: 'google.com', count: 5 }])
    await pool.sql`
      INSERT INTO conversion_summaries (period_start, period_end, intent_type, total_count, top_sources)
      VALUES (${period.start}, ${period.end}, 'INTENT_CALL', 10, ${topSources}::jsonb)
    `

    const result = await getConversionSummaries(pool, period)
    expect(result.isOk()).toBe(true)

    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.intent_type).toBe('INTENT_CALL')
    expect(rows[0]!.total_count).toBe(10)
    expect(rows[0]!.top_sources).toEqual([{ referrer: 'google.com', count: 5 }])
  })
})

describe('insertIngestionHealth + getIngestionHealth', () => {
  it('round-trips an ingestion health record', async () => {
    const record = {
      period_start: period.start,
      payloads_accepted: 100,
      payloads_rejected: 5,
      avg_processing_ms: 12.5,
      buffer_saturation_pct: 0.75
    }

    const insertResult = await insertIngestionHealth(pool, record)
    expect(insertResult.isOk()).toBe(true)

    const inserted = insertResult._unsafeUnwrap()
    expect(inserted.payloads_accepted).toBe(100)
    expect(inserted.payloads_rejected).toBe(5)
    expect(inserted.avg_processing_ms).toBeCloseTo(12.5)
    expect(inserted.buffer_saturation_pct).toBeCloseTo(0.75)

    const getResult = await getIngestionHealth(pool, period)
    expect(getResult.isOk()).toBe(true)

    const rows = getResult._unsafeUnwrap()
    expect(rows).toHaveLength(1)
    expect(rows[0]!.payloads_accepted).toBe(100)
  })

  it('returns empty when no health records exist', async () => {
    const result = await getIngestionHealth(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })
})
