import type { DbPool } from '@valencets/db'

export interface TelemetrySchedulerHandle {
  readonly stop: () => void
}

/**
 * Start a periodic telemetry aggregation scheduler.
 * Runs session, event, and daily summary aggregation on the given interval.
 *
 * @param pool — database pool
 * @param siteId — telemetry site identifier (matches daily_summaries.site_id)
 * @param intervalMs — aggregation interval in ms (default 15 minutes)
 */
export function startTelemetryScheduler (
  pool: DbPool,
  siteId: string = 'default',
  intervalMs: number = 15 * 60_000
): TelemetrySchedulerHandle {
  async function aggregate (): Promise<void> {
    const now = new Date()
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const dayEnd = new Date(dayStart.getTime() + 86_400_000)
    const s = dayStart.toISOString()
    const e = dayEnd.toISOString()
    const dateOnly = s.split('T')[0]

    try {
      // Session summaries
      await pool.sql.unsafe(`
        INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
        SELECT $1::timestamptz, $2::timestamptz, COUNT(*)::int, COUNT(DISTINCT referrer)::int,
          COUNT(*) FILTER (WHERE device_type = 'mobile')::int,
          COUNT(*) FILTER (WHERE device_type = 'desktop')::int,
          COUNT(*) FILTER (WHERE device_type = 'tablet')::int
        FROM sessions WHERE created_at >= $1 AND created_at < $2
        ON CONFLICT (period_start, period_end) DO UPDATE SET
          total_sessions = EXCLUDED.total_sessions, unique_referrers = EXCLUDED.unique_referrers,
          device_mobile = EXCLUDED.device_mobile, device_desktop = EXCLUDED.device_desktop, device_tablet = EXCLUDED.device_tablet
      `, [s, e])

      // Event summaries
      await pool.sql.unsafe(`
        INSERT INTO event_summaries (period_start, period_end, event_category, total_count, unique_sessions)
        SELECT $1::timestamptz, $2::timestamptz, event_category, COUNT(*)::int, COUNT(DISTINCT session_id)::int
        FROM events WHERE created_at >= $1 AND created_at < $2
        GROUP BY event_category
        ON CONFLICT (period_start, period_end, event_category) DO UPDATE SET
          total_count = EXCLUDED.total_count, unique_sessions = EXCLUDED.unique_sessions
      `, [s, e])

      // Daily summary
      const sessions = await pool.sql.unsafe(
        'SELECT COALESCE(SUM(total_sessions), 0)::int AS c FROM session_summaries WHERE period_start >= $1 AND period_end <= $2', [s, e]
      )
      const pageviews = await pool.sql.unsafe(
        'SELECT COALESCE(SUM(total_count), 0)::int AS c FROM event_summaries WHERE period_start >= $1 AND period_end <= $2 AND event_category IN (\'CLICK\', \'VIEWPORT_INTERSECT\')', [s, e]
      )
      const conversions = await pool.sql.unsafe(
        'SELECT COALESCE(SUM(total_count), 0)::int AS c FROM event_summaries WHERE period_start >= $1 AND period_end <= $2 AND event_category IN (\'INTENT_LEAD\', \'LEAD_FORM\', \'LEAD_EMAIL\', \'LEAD_PHONE\')', [s, e]
      )

      await pool.sql.unsafe(`
        INSERT INTO daily_summaries (site_id, date, business_type, schema_version, session_count, pageview_count, conversion_count, top_referrers, top_pages, intent_counts, avg_flush_ms, rejection_count, synced_at)
        VALUES ($1, $2, 'webapp', 1, $3, $4, $5, '[]', '[]', '{}', 0, 0, NOW())
        ON CONFLICT (site_id, date) DO UPDATE SET
          session_count = EXCLUDED.session_count, pageview_count = EXCLUDED.pageview_count,
          conversion_count = EXCLUDED.conversion_count, synced_at = NOW()
      `, [siteId, dateOnly, (sessions as any[])[0]?.c ?? 0, (pageviews as any[])[0]?.c ?? 0, (conversions as any[])[0]?.c ?? 0])
    } catch {
      // Aggregation failure is non-fatal — tables may not exist yet
    }
  }

  // Run once immediately, then on interval
  aggregate()
  const timer = setInterval(aggregate, intervalMs)
  return { stop: () => clearInterval(timer) }
}
