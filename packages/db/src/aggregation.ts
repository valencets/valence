import { ResultAsync } from 'neverthrow'
import type { DbError } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'
import type { SessionSummaryRow, EventSummaryRow, ConversionSummaryRow, SummaryPeriod } from './summary-types.js'

export function aggregateSessionSummary (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<SessionSummaryRow, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<SessionSummaryRow[]>`
        INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
        SELECT
          ${period.start} AS period_start,
          ${period.end} AS period_end,
          COUNT(*)::int AS total_sessions,
          COUNT(DISTINCT referrer)::int AS unique_referrers,
          COUNT(*) FILTER (WHERE device_type = 'mobile')::int AS device_mobile,
          COUNT(*) FILTER (WHERE device_type = 'desktop')::int AS device_desktop,
          COUNT(*) FILTER (WHERE device_type = 'tablet')::int AS device_tablet
        FROM sessions
        WHERE created_at >= ${period.start} AND created_at < ${period.end}
        RETURNING *
      `
      const row = rows[0]
      if (!row) {
        throw new Error('Aggregation returned no rows')
      }
      return row
    })(),
    mapPostgresError
  )
}

export function aggregateEventSummary (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<EventSummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<EventSummaryRow[]>`
        INSERT INTO event_summaries (period_start, period_end, event_category, total_count, unique_sessions)
        SELECT
          ${period.start} AS period_start,
          ${period.end} AS period_end,
          event_category,
          COUNT(*)::int AS total_count,
          COUNT(DISTINCT session_id)::int AS unique_sessions
        FROM events
        WHERE created_at >= ${period.start} AND created_at < ${period.end}
        GROUP BY event_category
        RETURNING *
      `
      return rows as ReadonlyArray<EventSummaryRow>
    })(),
    mapPostgresError
  )
}

export function aggregateConversionSummary (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<ConversionSummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<ConversionSummaryRow[]>`
        INSERT INTO conversion_summaries (period_start, period_end, intent_type, total_count, top_sources)
        SELECT
          ${period.start} AS period_start,
          ${period.end} AS period_end,
          e.event_category AS intent_type,
          COUNT(*)::int AS total_count,
          COALESCE(
            jsonb_agg(
              jsonb_build_object('referrer', s.referrer, 'count', sub.ref_count)
            ) FILTER (WHERE s.referrer IS NOT NULL),
            '[]'::jsonb
          ) AS top_sources
        FROM events e
        JOIN sessions s ON s.session_id = e.session_id
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS ref_count
          FROM events e2
          JOIN sessions s2 ON s2.session_id = e2.session_id
          WHERE e2.event_category = e.event_category
            AND s2.referrer = s.referrer
            AND e2.created_at >= ${period.start}
            AND e2.created_at < ${period.end}
        ) sub ON true
        WHERE e.created_at >= ${period.start} AND e.created_at < ${period.end}
          AND e.event_category IN ('INTENT_CALL', 'INTENT_BOOK', 'INTENT_NAVIGATE')
        GROUP BY e.event_category
        RETURNING *
      `
      return rows as ReadonlyArray<ConversionSummaryRow>
    })(),
    mapPostgresError
  )
}
