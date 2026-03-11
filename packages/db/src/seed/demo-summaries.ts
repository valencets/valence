import { ResultAsync, ok } from 'neverthrow'
import type { DbError } from '../types.js'
import type { DbPool } from '../connection.js'
import { mapPostgresError } from '../connection.js'

function todayPeriod (): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

export function seedDemoSummaries (pool: DbPool): ResultAsync<true, DbError> {
  const { start, end } = todayPeriod()

  return ResultAsync.fromPromise(
    (async () => {
      // Session summary — realistic local business traffic
      await pool.sql`
        INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
        VALUES (${start}, ${end}, 247, 8, 156, 72, 19)
        ON CONFLICT DO NOTHING
      `

      // Event summaries — lead actions
      const eventCategories = [
        { category: 'INTENT_LEAD', count: 45, sessions: 38 },
        { category: 'INTENT_CALL', count: 28, sessions: 26 },
        { category: 'INTENT_BOOK', count: 12, sessions: 11 },
        { category: 'CLICK', count: 892, sessions: 210 },
        { category: 'SCROLL', count: 1540, sessions: 235 },
        { category: 'VIEWPORT_INTERSECT', count: 3100, sessions: 240 }
      ]

      for (const ev of eventCategories) {
        await pool.sql`
          INSERT INTO event_summaries (period_start, period_end, event_category, total_count, unique_sessions)
          VALUES (${start}, ${end}, ${ev.category}, ${ev.count}, ${ev.sessions})
          ON CONFLICT DO NOTHING
        `
      }

      // Conversion summaries
      const conversions = [
        { intent: 'INTENT_LEAD', count: 45, sources: JSON.stringify([{ referrer: 'google', count: 22 }, { referrer: 'direct', count: 15 }, { referrer: 'yelp', count: 8 }]) },
        { intent: 'INTENT_CALL', count: 28, sources: JSON.stringify([{ referrer: 'google', count: 18 }, { referrer: 'direct', count: 10 }]) }
      ]

      for (const conv of conversions) {
        await pool.sql`
          INSERT INTO conversion_summaries (period_start, period_end, intent_type, total_count, top_sources)
          VALUES (${start}, ${end}, ${conv.intent}, ${conv.count}, ${conv.sources}::jsonb)
          ON CONFLICT DO NOTHING
        `
      }

      // Ingestion health
      await pool.sql`
        INSERT INTO ingestion_health (period_start, payloads_accepted, payloads_rejected, avg_processing_ms, buffer_saturation_pct)
        VALUES (${start}, 5847, 23, 2.8, 14)
        ON CONFLICT DO NOTHING
      `

      return ok(true as const)
    })(),
    mapPostgresError
  ).andThen((r) => r)
}
