import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import { DbErrorCode, mapPostgresError } from '@valencets/db'
import type { DbError, DbPool } from '@valencets/db'
import type { SessionSummaryRow, EventSummaryRow, ConversionSummaryRow, SummaryPeriod } from './summary-types.js'

export function aggregateSessionSummary (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<SessionSummaryRow, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<SessionSummaryRow[]>`
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
      ON CONFLICT (period_start, period_end) DO UPDATE SET
        total_sessions = EXCLUDED.total_sessions,
        unique_referrers = EXCLUDED.unique_referrers,
        device_mobile = EXCLUDED.device_mobile,
        device_desktop = EXCLUDED.device_desktop,
        device_tablet = EXCLUDED.device_tablet
      RETURNING *
    `,
    mapPostgresError
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) return errAsync({ code: DbErrorCode.NO_ROWS, message: 'Aggregation returned no rows' })
    return okAsync(row)
  })
}

export function aggregateEventSummary (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<EventSummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<EventSummaryRow[]>`
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
      ON CONFLICT (period_start, period_end, event_category) DO UPDATE SET
        total_count = EXCLUDED.total_count,
        unique_sessions = EXCLUDED.unique_sessions
      RETURNING *
    `,
    mapPostgresError
  ).map((rows) => rows as ReadonlyArray<EventSummaryRow>)
}

export function aggregateConversionSummary (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<ConversionSummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<ConversionSummaryRow[]>`
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
        AND e.event_category IN ('INTENT_CALL', 'INTENT_BOOK', 'LEAD_PHONE', 'LEAD_EMAIL', 'LEAD_FORM')
      GROUP BY e.event_category
      ON CONFLICT (period_start, period_end, intent_type) DO UPDATE SET
        total_count = EXCLUDED.total_count,
        top_sources = EXCLUDED.top_sources
      RETURNING *
    `,
    mapPostgresError
  ).map((rows) => rows as ReadonlyArray<ConversionSummaryRow>)
}
