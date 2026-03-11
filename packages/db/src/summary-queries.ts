import { ResultAsync } from 'neverthrow'
import type { DbError } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'
import type {
  SessionSummaryRow,
  EventSummaryRow,
  ConversionSummaryRow,
  IngestionHealthRow,
  SummaryPeriod
} from './summary-types.js'

export function getSessionSummaries (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<SessionSummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<SessionSummaryRow[]>`
        SELECT *
        FROM session_summaries
        WHERE period_start >= ${period.start} AND period_end <= ${period.end}
        ORDER BY period_start DESC
      `
      return rows as ReadonlyArray<SessionSummaryRow>
    })(),
    mapPostgresError
  )
}

export function getEventSummaries (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<EventSummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<EventSummaryRow[]>`
        SELECT *
        FROM event_summaries
        WHERE period_start >= ${period.start} AND period_end <= ${period.end}
        ORDER BY period_start DESC
      `
      return rows as ReadonlyArray<EventSummaryRow>
    })(),
    mapPostgresError
  )
}

export function getConversionSummaries (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<ConversionSummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<ConversionSummaryRow[]>`
        SELECT *
        FROM conversion_summaries
        WHERE period_start >= ${period.start} AND period_end <= ${period.end}
        ORDER BY period_start DESC
      `
      return rows as ReadonlyArray<ConversionSummaryRow>
    })(),
    mapPostgresError
  )
}

export function getIngestionHealth (
  pool: DbPool,
  period: SummaryPeriod
): ResultAsync<ReadonlyArray<IngestionHealthRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<IngestionHealthRow[]>`
        SELECT *
        FROM ingestion_health
        WHERE period_start >= ${period.start}
        ORDER BY period_start DESC
      `
      return rows as ReadonlyArray<IngestionHealthRow>
    })(),
    mapPostgresError
  )
}

export function insertIngestionHealth (
  pool: DbPool,
  record: {
    readonly period_start: Date
    readonly payloads_accepted: number
    readonly payloads_rejected: number
    readonly avg_processing_ms: number
    readonly buffer_saturation_pct: number
  }
): ResultAsync<IngestionHealthRow, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<IngestionHealthRow[]>`
        INSERT INTO ingestion_health (period_start, payloads_accepted, payloads_rejected, avg_processing_ms, buffer_saturation_pct)
        VALUES (${record.period_start}, ${record.payloads_accepted}, ${record.payloads_rejected}, ${record.avg_processing_ms}, ${record.buffer_saturation_pct})
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
