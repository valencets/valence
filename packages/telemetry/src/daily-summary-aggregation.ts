import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import type { JSONValue } from 'postgres'
import { DbErrorCode, mapPostgresError } from '@valencets/db'
import type { DbError, DbPool } from '@valencets/db'
import type { DailySummaryRow } from './daily-summary-types.js'
import { PAGEVIEW_CATEGORIES, CONVERSION_CATEGORIES } from './beacon-types.js'

/** Converts a structured value to a postgres-compatible JSONValue via round-trip serialization. */
function toJson (val: object): JSONValue {
  return JSON.parse(JSON.stringify(val)) as JSONValue
}

function dayBounds (date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

interface SessionAgg {
  readonly total_sessions: number
}

interface PageviewAgg {
  readonly pageview_count: number
}

interface ConversionAgg {
  readonly conversion_count: number
}

interface ReferrerAgg {
  readonly referrer: string
  readonly count: number
}

interface PageAgg {
  readonly path: string
  readonly count: number
}

interface IntentAgg {
  readonly event_category: string
  readonly count: number
}

interface HealthAgg {
  readonly avg_flush_ms: number
  readonly rejection_count: number
}

function querySessionCount (pool: DbPool, start: Date, end: Date): Promise<number> {
  return pool.sql<SessionAgg[]>`
    SELECT COALESCE(SUM(total_sessions), 0)::int AS total_sessions
    FROM session_summaries
    WHERE period_start >= ${start} AND period_end <= ${end}
  `.then((rows) => rows[0]?.total_sessions ?? 0)
}

function queryPageviewCount (pool: DbPool, start: Date, end: Date): Promise<number> {
  return pool.sql<PageviewAgg[]>`
    SELECT COALESCE(SUM(total_count), 0)::int AS pageview_count
    FROM event_summaries
    WHERE period_start >= ${start} AND period_end <= ${end}
      AND event_category = ANY(${pool.sql.array([...PAGEVIEW_CATEGORIES])})
  `.then((rows) => rows[0]?.pageview_count ?? 0)
}

function queryConversionCount (pool: DbPool, start: Date, end: Date): Promise<number> {
  return pool.sql<ConversionAgg[]>`
    SELECT COALESCE(SUM(total_count), 0)::int AS conversion_count
    FROM event_summaries
    WHERE period_start >= ${start} AND period_end <= ${end}
      AND event_category = ANY(${pool.sql.array([...CONVERSION_CATEGORIES])})
  `.then((rows) => rows[0]?.conversion_count ?? 0)
}

/**
 * Reads from raw `sessions` table intentionally — session_summaries only store
 * aggregate counts (total_sessions, unique_referrers), not per-referrer breakdowns
 * needed for top referrers ranking.
 */
function queryTopReferrers (pool: DbPool, start: Date, end: Date): Promise<ReadonlyArray<{ referrer: string; count: number }>> {
  return pool.sql<ReferrerAgg[]>`
    SELECT COALESCE(referrer, '') AS referrer, COUNT(*)::int AS count
    FROM sessions
    WHERE created_at >= ${start} AND created_at < ${end}
    GROUP BY COALESCE(referrer, '')
    ORDER BY count DESC
    LIMIT 10
  `.then((rows) => rows.map((r) => ({ referrer: r.referrer, count: r.count })))
}

/**
 * Reads from raw `events` table intentionally — event_summaries only store
 * per-category totals, not per-path breakdowns needed for top pages ranking.
 * Uses PAGEVIEW_CATEGORIES to stay consistent with queryPageviewCount.
 */
function queryTopPages (pool: DbPool, start: Date, end: Date): Promise<ReadonlyArray<{ path: string; count: number }>> {
  return pool.sql<PageAgg[]>`
    SELECT payload->>'path' AS path, COUNT(*)::int AS count
    FROM events
    WHERE created_at >= ${start} AND created_at < ${end}
      AND event_category = ANY(${pool.sql.array([...PAGEVIEW_CATEGORIES])})
      AND payload->>'path' IS NOT NULL
    GROUP BY payload->>'path'
    ORDER BY count DESC
    LIMIT 10
  `.then((rows) => rows.map((r) => ({ path: r.path, count: r.count })))
}

function queryIntentCounts (pool: DbPool, start: Date, end: Date): Promise<Readonly<Record<string, number>>> {
  return pool.sql<IntentAgg[]>`
    SELECT event_category, COALESCE(SUM(total_count), 0)::int AS count
    FROM event_summaries
    WHERE period_start >= ${start} AND period_end <= ${end}
    GROUP BY event_category
  `.then((rows) => {
      const counts: Record<string, number> = {}
      for (const r of rows) {
        counts[r.event_category] = r.count
      }
      return counts
    })
}

function queryHealthMetrics (pool: DbPool, start: Date): Promise<{ avg_flush_ms: number; rejection_count: number }> {
  return pool.sql<HealthAgg[]>`
    SELECT
      COALESCE(AVG(avg_processing_ms), 0) AS avg_flush_ms,
      COALESCE(SUM(payloads_rejected), 0)::int AS rejection_count
    FROM ingestion_health
    WHERE period_start >= ${start}
  `.then((rows) => ({
      avg_flush_ms: rows[0]?.avg_flush_ms ?? 0,
      rejection_count: rows[0]?.rejection_count ?? 0
    }))
}

export function generateDailySummary (
  pool: DbPool,
  siteId: string,
  businessType: string,
  date: Date
): ResultAsync<DailySummaryRow, DbError> {
  const { start, end } = dayBounds(date)

  return ResultAsync.fromPromise(
    (async () => {
      const [sessionCount, pageviewCount, conversionCount, topReferrers, topPages, intentCounts, health] = await Promise.all([
        querySessionCount(pool, start, end),
        queryPageviewCount(pool, start, end),
        queryConversionCount(pool, start, end),
        queryTopReferrers(pool, start, end),
        queryTopPages(pool, start, end),
        queryIntentCounts(pool, start, end),
        queryHealthMetrics(pool, start)
      ])

      const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate())

      const rows = await pool.sql<DailySummaryRow[]>`
        INSERT INTO daily_summaries (
          site_id, date, business_type, schema_version,
          session_count, pageview_count, conversion_count,
          top_referrers, top_pages, intent_counts,
          avg_flush_ms, rejection_count, synced_at
        )
        VALUES (
          ${siteId}, ${dateOnly}, ${businessType}, ${1},
          ${sessionCount}, ${pageviewCount}, ${conversionCount},
          ${pool.sql.json(toJson(topReferrers))}, ${pool.sql.json(toJson(topPages))}, ${pool.sql.json(toJson(intentCounts))},
          ${health.avg_flush_ms}, ${health.rejection_count}, NOW()
        )
        ON CONFLICT (site_id, date) DO UPDATE SET
          business_type = EXCLUDED.business_type,
          session_count = EXCLUDED.session_count,
          pageview_count = EXCLUDED.pageview_count,
          conversion_count = EXCLUDED.conversion_count,
          top_referrers = EXCLUDED.top_referrers,
          top_pages = EXCLUDED.top_pages,
          intent_counts = EXCLUDED.intent_counts,
          avg_flush_ms = EXCLUDED.avg_flush_ms,
          rejection_count = EXCLUDED.rejection_count,
          synced_at = NOW()
        RETURNING *
      `

      return rows
    })(),
    mapPostgresError
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) return errAsync({ code: DbErrorCode.NO_ROWS, message: 'Upsert returned no rows' })
    return okAsync(row)
  })
}
