import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, teardownTestDatabase, getAppPool } from './setup.js'
import { generateDailySummary } from '../../daily-summary-aggregation.js'
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
  await pool.sql`DELETE FROM ingestion_health`
  await pool.sql`DELETE FROM conversion_summaries`
  await pool.sql`DELETE FROM event_summaries`
  await pool.sql`DELETE FROM session_summaries`
  await pool.sql`DELETE FROM events`
  await pool.sql`DELETE FROM sessions`
})

// Use local-time date to match dayBounds() in daily-summary-aggregation.ts
const testDate = new Date(2026, 2, 15)
const dayStart = new Date(testDate.getFullYear(), testDate.getMonth(), testDate.getDate())
const dayEnd = new Date(dayStart.getTime() + 86_400_000)

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

describe('generateDailySummary', () => {
  it('aggregates all 7 sub-queries into a single daily summary row', async () => {
    // Use a timestamp within the local-time day bounds
    const ts = new Date(dayStart.getTime() + 10 * 3600_000)

    // Seed sessions
    const s1 = await seedSession('mobile', 'google.com', ts)
    const s2 = await seedSession('desktop', 'bing.com', ts)

    // Seed events (pageviews + conversions)
    await seedEvent(s1, 'CLICK', ts, { path: '/home' })
    await seedEvent(s1, 'VIEWPORT_INTERSECT', ts, { path: '/home' })
    await seedEvent(s2, 'VIEWPORT_INTERSECT', ts, { path: '/about' })
    await seedEvent(s1, 'INTENT_CALL', ts)

    // Pre-aggregate session + event summaries (generateDailySummary reads from summary tables)
    const period = { start: dayStart, end: dayEnd }
    await pool.sql`
      INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
      VALUES (${period.start}, ${period.end}, 2, 2, 1, 1, 0)
    `
    await pool.sql`
      INSERT INTO event_summaries (period_start, period_end, event_category, total_count, unique_sessions)
      VALUES
        (${period.start}, ${period.end}, 'CLICK', 1, 1),
        (${period.start}, ${period.end}, 'VIEWPORT_INTERSECT', 2, 2),
        (${period.start}, ${period.end}, 'INTENT_CALL', 1, 1)
    `

    // Seed ingestion health
    await pool.sql`
      INSERT INTO ingestion_health (period_start, payloads_accepted, payloads_rejected, avg_processing_ms, buffer_saturation_pct)
      VALUES (${dayStart}, 50, 2, 8.5, 0.3)
    `

    const result = await generateDailySummary(pool, 'site-1', 'dental', testDate)
    expect(result.isOk()).toBe(true)

    const row = result.unwrap()
    expect(row.site_id).toBe('site-1')
    expect(row.business_type).toBe('dental')
    expect(row.schema_version).toBe(1)

    // session_count comes from session_summaries
    expect(row.session_count).toBe(2)

    // pageview_count = CLICK + VIEWPORT_INTERSECT
    expect(row.pageview_count).toBe(3)

    // conversion_count = INTENT_CALL
    expect(row.conversion_count).toBe(1)

    // top_referrers from raw sessions
    expect(Array.isArray(row.top_referrers)).toBe(true)
    expect(row.top_referrers!.length).toBeGreaterThanOrEqual(1)

    // top_pages from raw events with VIEWPORT_INTERSECT
    expect(Array.isArray(row.top_pages)).toBe(true)

    // intent_counts from event_summaries grouped by category
    expect(row.intent_counts).toBeDefined()

    // health metrics from ingestion_health
    expect(row.avg_flush_ms).toBeCloseTo(8.5)
    expect(row.rejection_count).toBe(2)

    // synced_at should be set
    expect(row.synced_at).not.toBeNull()
  })

  it('produces zero counts when no data exists for the day', async () => {
    const result = await generateDailySummary(pool, 'site-empty', 'plumbing', testDate)
    expect(result.isOk()).toBe(true)

    const row = result.unwrap()
    expect(row.session_count).toBe(0)
    expect(row.pageview_count).toBe(0)
    expect(row.conversion_count).toBe(0)
    expect(row.avg_flush_ms).toBeCloseTo(0)
    expect(row.rejection_count).toBe(0)
  })

  it('upserts on same site_id + date', async () => {
    const result1 = await generateDailySummary(pool, 'site-dup', 'dental', testDate)
    expect(result1.isOk()).toBe(true)

    // Add some data and re-aggregate
    await pool.sql`
      INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
      VALUES (${dayStart}, ${dayEnd}, 5, 3, 2, 2, 1)
      ON CONFLICT (period_start, period_end) DO UPDATE SET total_sessions = 5
    `

    const result2 = await generateDailySummary(pool, 'site-dup', 'dental', testDate)
    expect(result2.isOk()).toBe(true)
    expect(result2.unwrap().session_count).toBe(5)

    // Only one row for this site+date
    const rows = await pool.sql`
      SELECT * FROM daily_summaries WHERE site_id = 'site-dup'
    `
    expect(rows.length).toBe(1)
  })
})
