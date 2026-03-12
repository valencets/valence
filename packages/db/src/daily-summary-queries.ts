import { ResultAsync } from 'neverthrow'
import type { DbError } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'
import type { DailySummaryRow, DailySummaryPayload } from './daily-summary-types.js'

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
          ${JSON.stringify(summary.top_referrers)}::jsonb, ${JSON.stringify(summary.top_pages)}::jsonb, ${JSON.stringify(summary.intent_counts)}::jsonb,
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
        throw new Error('INSERT returned no rows')
      }
      return row
    })(),
    mapPostgresError
  )
}
