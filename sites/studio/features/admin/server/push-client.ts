import { ResultAsync } from 'neverthrow'
import { signPayload } from '@inertia/ingestion'
import type { DailySummaryRow, DailySummaryPayload } from '@inertia/db'

export const PushErrorCode = {
  PUSH_FAILED: 'PUSH_FAILED'
} as const

export type PushErrorCode = typeof PushErrorCode[keyof typeof PushErrorCode]

export interface PushError {
  readonly code: PushErrorCode
  readonly message: string
}

export interface PushConfig {
  readonly studioEndpoint: string
  readonly siteSecret: string
}

function formatDate (date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function rowToPayload (row: DailySummaryRow): DailySummaryPayload {
  return {
    site_id: row.site_id,
    date: formatDate(row.date),
    business_type: row.business_type,
    schema_version: row.schema_version,
    session_count: row.session_count,
    pageview_count: row.pageview_count,
    conversion_count: row.conversion_count,
    top_referrers: row.top_referrers,
    top_pages: row.top_pages,
    intent_counts: row.intent_counts,
    avg_flush_ms: row.avg_flush_ms,
    rejection_count: row.rejection_count
  }
}

function mapPushError (e: unknown): PushError {
  return {
    code: PushErrorCode.PUSH_FAILED,
    message: e instanceof Error ? e.message : 'Push failed'
  }
}

export function pushDailySummary (
  config: PushConfig,
  row: DailySummaryRow
): ResultAsync<true, PushError> {
  return ResultAsync.fromPromise(
    (async () => {
      const payload = rowToPayload(row)
      const body = JSON.stringify(payload)
      const signature = signPayload(config.siteSecret, body)

      await fetch(config.studioEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Inertia-Signature': signature
        },
        body
      })

      return true as const
    })(),
    mapPushError
  )
}
