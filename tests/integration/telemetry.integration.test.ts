import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import {
  setupTestDatabase,
  teardownTestDatabase,
  getAppPool
} from '../../packages/telemetry/src/__tests__/integration/setup.js'
import {
  ingestBeacon,
  validateBeaconPayload,
  generateDailySummary,
  BeaconValidationErrorCode
} from '@valencets/telemetry'
import type { DbPool } from '@valencets/db'
import type { BeaconEvent } from '@valencets/telemetry'

let pool: DbPool

beforeAll(async () => {
  await setupTestDatabase()
  pool = getAppPool()
}, 30_000)

afterAll(async () => {
  await teardownTestDatabase()
}, 15_000)

beforeEach(async () => {
  await pool.sql`DELETE FROM daily_summaries`
  await pool.sql`DELETE FROM ingestion_health`
  await pool.sql`DELETE FROM conversion_summaries`
  await pool.sql`DELETE FROM event_summaries`
  await pool.sql`DELETE FROM session_summaries`
  await pool.sql`DELETE FROM events`
  await pool.sql`DELETE FROM sessions`
})

function makeEvent (overrides: Partial<BeaconEvent> = {}): BeaconEvent {
  return {
    id: 'evt-001',
    timestamp: Date.now(),
    type: 'CLICK',
    targetDOMNode: 'button.cta',
    x_coord: 100,
    y_coord: 200,
    schema_version: 1,
    site_id: 'site-test',
    business_type: 'dental',
    path: '/home',
    referrer: 'google.com',
    ...overrides
  }
}

describe('Telemetry pipeline integration tests', () => {
  describe('ingestBeacon — valid ingestion', () => {
    it('stores a single event and returns session_id + eventsInserted', async () => {
      const result = await ingestBeacon(pool, [makeEvent()])

      expect(result.isOk()).toBe(true)
      const value = result._unsafeUnwrap()
      expect(value.eventsInserted).toBe(1)
      expect(value.sessionId).toBeTruthy()

      const sessions = await pool.sql<Array<{ session_id: string }>>`
        SELECT session_id FROM sessions WHERE session_id = ${value.sessionId}::uuid
      `
      expect(sessions).toHaveLength(1)
    })

    it('stores all events in a batch linked to the same session', async () => {
      const events: ReadonlyArray<BeaconEvent> = [
        makeEvent({ id: 'evt-001', type: 'CLICK' }),
        makeEvent({ id: 'evt-002', type: 'SCROLL' }),
        makeEvent({ id: 'evt-003', type: 'LEAD_FORM' })
      ]

      const result = await ingestBeacon(pool, events)

      expect(result.isOk()).toBe(true)
      const { eventsInserted, sessionId } = result._unsafeUnwrap()
      expect(eventsInserted).toBe(3)

      const stored = await pool.sql<Array<{ event_category: string }>>`
        SELECT event_category FROM events
        WHERE session_id = ${sessionId}::uuid
        ORDER BY event_id
      `
      expect(stored).toHaveLength(3)
      expect(stored[0]!.event_category).toBe('CLICK')
      expect(stored[1]!.event_category).toBe('SCROLL')
      expect(stored[2]!.event_category).toBe('LEAD_FORM')
    })

    it('stores event payload including path and coordinates', async () => {
      const result = await ingestBeacon(pool, [
        makeEvent({ path: '/pricing', x_coord: 42, y_coord: 88, targetDOMNode: 'a.plan-link' })
      ])

      expect(result.isOk()).toBe(true)
      const { sessionId } = result._unsafeUnwrap()

      const rows = await pool.sql<Array<{ payload: { path: string; x_coord: number; y_coord: number }; dom_target: string }>>`
        SELECT payload, dom_target FROM events WHERE session_id = ${sessionId}::uuid
      `
      expect(rows).toHaveLength(1)
      expect(rows[0]!.payload.path).toBe('/pricing')
      expect(rows[0]!.payload.x_coord).toBe(42)
      expect(rows[0]!.payload.y_coord).toBe(88)
      expect(rows[0]!.dom_target).toBe('a.plan-link')
    })

    it('creates separate sessions for separate ingest calls', async () => {
      const r1 = await ingestBeacon(pool, [makeEvent({ referrer: 'google.com' })])
      const r2 = await ingestBeacon(pool, [makeEvent({ referrer: 'bing.com' })])

      expect(r1.isOk()).toBe(true)
      expect(r2.isOk()).toBe(true)
      expect(r1._unsafeUnwrap().sessionId).not.toBe(r2._unsafeUnwrap().sessionId)

      const sessions = await pool.sql`SELECT session_id FROM sessions`
      expect(sessions).toHaveLength(2)
    })
  })

  describe('validateBeaconPayload — malformed rejection', () => {
    it('rejects invalid JSON without touching the database', async () => {
      const result = validateBeaconPayload('not-json')

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_JSON)

      const rows = await pool.sql`SELECT session_id FROM sessions`
      expect(rows).toHaveLength(0)
    })

    it('rejects an empty array payload', async () => {
      const result = validateBeaconPayload('[]')

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.EMPTY_PAYLOAD)
    })

    it('rejects a payload with a missing required field', async () => {
      const raw = JSON.stringify([{ id: 'x', type: 'CLICK' }])
      const result = validateBeaconPayload(raw)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.MISSING_FIELD)
    })

    it('rejects a payload with an invalid intent type', async () => {
      const raw = JSON.stringify([{
        id: 'x',
        timestamp: Date.now(),
        type: 'INVALID_TYPE',
        targetDOMNode: 'div',
        x_coord: 0,
        y_coord: 0,
        schema_version: 1,
        site_id: 'site-a',
        business_type: 'dental',
        path: '/home',
        referrer: 'google.com'
      }])
      const result = validateBeaconPayload(raw)

      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_INTENT_TYPE)
    })
  })

  describe('generateDailySummary — aggregation', () => {
    it('produces zero counts when no data exists for the day', async () => {
      const testDate = new Date(2026, 2, 19)
      const result = await generateDailySummary(pool, 'site-empty', 'plumbing', testDate)

      expect(result.isOk()).toBe(true)
      const row = result._unsafeUnwrap()
      expect(row.session_count).toBe(0)
      expect(row.pageview_count).toBe(0)
      expect(row.conversion_count).toBe(0)
      expect(row.avg_flush_ms).toBeCloseTo(0)
      expect(row.rejection_count).toBe(0)
    })

    it('aggregates pre-seeded summary tables into a daily summary row', async () => {
      const testDate = new Date(2026, 2, 19)
      const dayStart = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate())
      const dayEnd = new Date(dayStart.getTime() + 86_400_000)
      const ts = new Date(dayStart.getTime() + 6 * 3600_000)

      const s1Rows = await pool.sql<Array<{ session_id: string }>>`
        INSERT INTO sessions (device_type, referrer, created_at)
        VALUES ('mobile', 'google.com', ${ts})
        RETURNING session_id
      `
      const s2Rows = await pool.sql<Array<{ session_id: string }>>`
        INSERT INTO sessions (device_type, referrer, created_at)
        VALUES ('desktop', 'bing.com', ${ts})
        RETURNING session_id
      `
      const sid1 = s1Rows[0]!.session_id
      const sid2 = s2Rows[0]!.session_id

      await pool.sql`
        INSERT INTO events (session_id, event_category, created_at)
        VALUES
          (${sid1}, 'VIEWPORT_INTERSECT', ${ts}),
          (${sid2}, 'VIEWPORT_INTERSECT', ${ts}),
          (${sid1}, 'INTENT_CALL', ${ts})
      `

      await pool.sql`
        INSERT INTO session_summaries
          (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
        VALUES (${dayStart}, ${dayEnd}, 2, 2, 1, 1, 0)
      `
      await pool.sql`
        INSERT INTO event_summaries
          (period_start, period_end, event_category, total_count, unique_sessions)
        VALUES
          (${dayStart}, ${dayEnd}, 'VIEWPORT_INTERSECT', 2, 2),
          (${dayStart}, ${dayEnd}, 'INTENT_CALL', 1, 1)
      `
      await pool.sql`
        INSERT INTO ingestion_health
          (period_start, payloads_accepted, payloads_rejected, avg_processing_ms, buffer_saturation_pct)
        VALUES (${dayStart}, 10, 1, 5.0, 0.1)
      `

      const result = await generateDailySummary(pool, 'site-test', 'dental', testDate)
      expect(result.isOk()).toBe(true)

      const row = result._unsafeUnwrap()
      expect(row.site_id).toBe('site-test')
      expect(row.session_count).toBe(2)
      expect(row.pageview_count).toBeGreaterThanOrEqual(2)
      expect(row.conversion_count).toBe(1)
      expect(row.avg_flush_ms).toBeCloseTo(5.0)
      expect(row.rejection_count).toBe(1)
    })

    it('upserts on same site_id + date, updating counts', async () => {
      const testDate = new Date(2026, 2, 19)
      const dayStart = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate())
      const dayEnd = new Date(dayStart.getTime() + 86_400_000)

      const r1 = await generateDailySummary(pool, 'site-dup', 'dental', testDate)
      expect(r1.isOk()).toBe(true)

      await pool.sql`
        INSERT INTO session_summaries
          (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
        VALUES (${dayStart}, ${dayEnd}, 7, 3, 3, 3, 1)
        ON CONFLICT (period_start, period_end) DO UPDATE SET total_sessions = 7
      `

      const r2 = await generateDailySummary(pool, 'site-dup', 'dental', testDate)
      expect(r2.isOk()).toBe(true)
      expect(r2._unsafeUnwrap().session_count).toBe(7)

      const rows = await pool.sql`SELECT id FROM daily_summaries WHERE site_id = 'site-dup'`
      expect(rows).toHaveLength(1)
    })
  })
})
