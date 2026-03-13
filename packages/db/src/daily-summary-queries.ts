import { ResultAsync } from 'neverthrow'
import type { JSONValue } from 'postgres'
import type { DbError } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'
import type { DailySummaryRow, DailySummaryPayload, DailyBreakdowns } from './daily-summary-types.js'

export function getDailySummary (
  pool: DbPool,
  siteId: string,
  date: Date
): ResultAsync<DailySummaryRow | null, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<DailySummaryRow[]>`
        SELECT *
        FROM daily_summaries
        WHERE site_id = ${siteId} AND date = ${date}
      `
      return rows[0] ?? null
    })(),
    mapPostgresError
  )
}

export function getUnsyncedDailySummaries (
  pool: DbPool,
  siteId: string
): ResultAsync<ReadonlyArray<DailySummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<DailySummaryRow[]>`
        SELECT *
        FROM daily_summaries
        WHERE site_id = ${siteId} AND synced_at IS NULL
        ORDER BY date ASC
      `
      return rows as ReadonlyArray<DailySummaryRow>
    })(),
    mapPostgresError
  )
}

export function markSynced (
  pool: DbPool,
  id: number
): ResultAsync<void, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      await pool.sql`
        UPDATE daily_summaries
        SET synced_at = NOW()
        WHERE id = ${id}
      `
    })(),
    mapPostgresError
  )
}

export function insertDailySummaryFromRemote (
  pool: DbPool,
  summary: DailySummaryPayload
): ResultAsync<DailySummaryRow, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<DailySummaryRow[]>`
        INSERT INTO daily_summaries (
          site_id, date, business_type, schema_version,
          session_count, pageview_count, conversion_count,
          top_referrers, top_pages, intent_counts,
          avg_flush_ms, rejection_count, synced_at
        )
        VALUES (
          ${summary.site_id}, ${summary.date}::date, ${summary.business_type}, ${summary.schema_version},
          ${summary.session_count}, ${summary.pageview_count}, ${summary.conversion_count},
          ${pool.sql.json(summary.top_referrers as unknown as JSONValue)}, ${pool.sql.json(summary.top_pages as unknown as JSONValue)}, ${pool.sql.json(summary.intent_counts as unknown as JSONValue)},
          ${summary.avg_flush_ms}, ${summary.rejection_count}, NOW()
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
      const row = rows[0]
      if (!row) {
        return Promise.reject(new Error('INSERT returned no rows'))
      }
      return row
    })(),
    mapPostgresError
  )
}

export function getDailyTrend (
  pool: DbPool,
  siteId: string,
  start: Date,
  end: Date
): ResultAsync<ReadonlyArray<DailySummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<DailySummaryRow[]>`
        SELECT date, session_count, pageview_count, conversion_count
        FROM daily_summaries
        WHERE site_id = ${siteId} AND date >= ${start} AND date <= ${end}
        ORDER BY date ASC
      `
      return rows as ReadonlyArray<DailySummaryRow>
    })(),
    mapPostgresError
  )
}

export function getDailyBreakdowns (
  pool: DbPool,
  siteId: string,
  start: Date,
  end: Date
): ResultAsync<DailyBreakdowns, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<DailySummaryRow[]>`
        SELECT top_pages, top_referrers, intent_counts
        FROM daily_summaries
        WHERE site_id = ${siteId} AND date >= ${start} AND date <= ${end}
        ORDER BY date DESC
      `
      if (rows.length === 0) {
        return { top_pages: [], top_referrers: [], intent_counts: {} }
      }

      // Merge breakdowns across multiple days
      const pageMap = new Map<string, number>()
      const referrerMap = new Map<string, number>()
      const intentMap: Record<string, number> = {}

      for (const row of rows) {
        if (row.top_pages) {
          for (const p of row.top_pages) {
            pageMap.set(p.path, (pageMap.get(p.path) ?? 0) + p.count)
          }
        }
        if (row.top_referrers) {
          for (const r of row.top_referrers) {
            referrerMap.set(r.referrer, (referrerMap.get(r.referrer) ?? 0) + r.count)
          }
        }
        if (row.intent_counts) {
          for (const [key, count] of Object.entries(row.intent_counts)) {
            intentMap[key] = (intentMap[key] ?? 0) + count
          }
        }
      }

      const topPages = [...pageMap.entries()]
        .map(([path, count]) => ({ path, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      const topReferrers = [...referrerMap.entries()]
        .map(([referrer, count]) => ({ referrer, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return { top_pages: topPages, top_referrers: topReferrers, intent_counts: intentMap }
    })(),
    mapPostgresError
  )
}
