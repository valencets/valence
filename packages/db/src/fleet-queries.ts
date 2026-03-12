import { ResultAsync } from 'neverthrow'
import type { DbError } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'
import type { DailySummaryRow } from './daily-summary-types.js'

export const FleetSiteStatus = {
  HEALTHY: 'healthy',
  STALE: 'stale',
  OFFLINE: 'offline'
} as const

export type FleetSiteStatus = typeof FleetSiteStatus[keyof typeof FleetSiteStatus]

export interface FleetSiteRow {
  readonly site_id: string
  readonly business_type: string
  readonly date: Date
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
  readonly status: FleetSiteStatus
  readonly last_synced: Date | null
}

export interface FleetComparisonRow {
  readonly business_type: string
  readonly avg_sessions: number
  readonly avg_conversions: number
  readonly top_performer_site_id: string
  readonly sparkline_data: ReadonlyArray<number>
}

export interface FleetFilter {
  readonly vertical?: string
  readonly status?: string
  readonly tier?: string
}

export interface FleetSort {
  readonly column: string
  readonly order: 'asc' | 'desc'
}

export interface FleetAggregateRow {
  readonly total_sites: number
  readonly total_sessions: number
  readonly total_conversions: number
}

export const FleetAlertSeverity = {
  RED: 'red',
  AMBER: 'amber',
  BLUE: 'blue'
} as const

export type FleetAlertSeverity = typeof FleetAlertSeverity[keyof typeof FleetAlertSeverity]

export const FleetAlertType = {
  OFFLINE: 'offline',
  HIGH_ERRORS: 'high_errors',
  NO_CONVERSIONS: 'no_conversions'
} as const

export type FleetAlertType = typeof FleetAlertType[keyof typeof FleetAlertType]

export interface FleetAlertRow {
  readonly site_id: string
  readonly severity: FleetAlertSeverity
  readonly type: FleetAlertType
  readonly message: string
}

const TWENTY_FOUR_HOURS = 86_400_000
const FORTY_EIGHT_HOURS = 172_800_000

function computeStatus (syncedAt: Date | null): FleetSiteStatus {
  if (syncedAt === null) return FleetSiteStatus.OFFLINE
  const age = Date.now() - syncedAt.getTime()
  if (age < TWENTY_FOUR_HOURS) return FleetSiteStatus.HEALTHY
  if (age < FORTY_EIGHT_HOURS) return FleetSiteStatus.STALE
  return FleetSiteStatus.OFFLINE
}

interface RawFleetSiteRow {
  readonly site_id: string
  readonly business_type: string
  readonly date: Date
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
  readonly synced_at: Date | null
}

export function getFleetSites (
  pool: DbPool,
  _filter?: FleetFilter,
  _sort?: FleetSort
): ResultAsync<ReadonlyArray<FleetSiteRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<RawFleetSiteRow[]>`
        SELECT DISTINCT ON (site_id)
          site_id, business_type, date, session_count, pageview_count, conversion_count, synced_at
        FROM daily_summaries
        ORDER BY site_id, date DESC
      `
      return rows.map((r): FleetSiteRow => ({
        site_id: r.site_id,
        business_type: r.business_type,
        date: r.date,
        session_count: r.session_count,
        pageview_count: r.pageview_count,
        conversion_count: r.conversion_count,
        status: computeStatus(r.synced_at),
        last_synced: r.synced_at
      }))
    })(),
    mapPostgresError
  )
}

interface RawComparisonRow {
  readonly business_type: string
  readonly avg_sessions: number
  readonly avg_conversions: number
  readonly top_performer_site_id: string
}

export function getFleetComparison (
  pool: DbPool,
  businessType: string
): ResultAsync<ReadonlyArray<FleetComparisonRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * TWENTY_FOUR_HOURS)

      const rows = await pool.sql<RawComparisonRow[]>`
        SELECT
          business_type,
          COALESCE(AVG(session_count), 0)::int AS avg_sessions,
          COALESCE(AVG(conversion_count), 0)::int AS avg_conversions,
          (
            SELECT site_id FROM daily_summaries d2
            WHERE d2.business_type = daily_summaries.business_type
              AND d2.date >= ${thirtyDaysAgo}
            GROUP BY site_id
            ORDER BY COALESCE(SUM(session_count), 0) DESC
            LIMIT 1
          ) AS top_performer_site_id
        FROM daily_summaries
        WHERE business_type = ${businessType}
          AND date >= ${thirtyDaysAgo}
        GROUP BY business_type
      `

      return rows.map((r): FleetComparisonRow => ({
        business_type: r.business_type,
        avg_sessions: r.avg_sessions,
        avg_conversions: r.avg_conversions,
        top_performer_site_id: r.top_performer_site_id ?? '',
        sparkline_data: []
      }))
    })(),
    mapPostgresError
  )
}

export function getFleetSiteHistory (
  pool: DbPool,
  siteId: string,
  days: number
): ResultAsync<ReadonlyArray<DailySummaryRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const since = new Date(Date.now() - days * TWENTY_FOUR_HOURS)
      const rows = await pool.sql<DailySummaryRow[]>`
        SELECT *
        FROM daily_summaries
        WHERE site_id = ${siteId} AND date >= ${since}
        ORDER BY date ASC
      `
      return rows as ReadonlyArray<DailySummaryRow>
    })(),
    mapPostgresError
  )
}

interface RawAggregateRow {
  readonly total_sites: number
  readonly total_sessions: number
  readonly total_conversions: number
}

const EMPTY_AGGREGATES: FleetAggregateRow = {
  total_sites: 0,
  total_sessions: 0,
  total_conversions: 0
}

export function getFleetAggregates (pool: DbPool): ResultAsync<FleetAggregateRow, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<RawAggregateRow[]>`
        SELECT
          COUNT(DISTINCT site_id)::int AS total_sites,
          COALESCE(SUM(session_count), 0)::int AS total_sessions,
          COALESCE(SUM(conversion_count), 0)::int AS total_conversions
        FROM daily_summaries
        WHERE date >= NOW() - INTERVAL '30 days'
      `
      return rows[0] ?? EMPTY_AGGREGATES
    })(),
    mapPostgresError
  )
}

interface RawAlertRow {
  readonly site_id: string
  readonly synced_at: Date | null
  readonly rejection_count: number | null
  readonly conversion_count: number | null
  readonly tier: string | null
}

const ONE_HOUR = 3_600_000

export function getFleetAlerts (pool: DbPool): ResultAsync<ReadonlyArray<FleetAlertRow>, DbError> {
  return ResultAsync.fromPromise(
    (async () => {
      const rows = await pool.sql<RawAlertRow[]>`
        SELECT DISTINCT ON (site_id)
          site_id, synced_at, rejection_count, conversion_count,
          (SELECT tier FROM sites s WHERE s.slug = daily_summaries.site_id) AS tier
        FROM daily_summaries
        ORDER BY site_id, date DESC
      `
      const alerts: FleetAlertRow[] = []
      const now = Date.now()

      for (const row of rows) {
        // Offline > 1 hour
        if (row.synced_at === null || (now - new Date(row.synced_at).getTime()) > ONE_HOUR) {
          alerts.push({
            site_id: row.site_id,
            severity: FleetAlertSeverity.RED,
            type: FleetAlertType.OFFLINE,
            message: `${row.site_id} has not synced`
          })
        }

        // High error rate
        if (row.rejection_count !== null && row.rejection_count > 50) {
          alerts.push({
            site_id: row.site_id,
            severity: FleetAlertSeverity.AMBER,
            type: FleetAlertType.HIGH_ERRORS,
            message: `${row.site_id} has ${row.rejection_count} rejections`
          })
        }

        // No conversions in managed tier
        if (row.tier === 'managed' && (row.conversion_count === null || row.conversion_count === 0)) {
          alerts.push({
            site_id: row.site_id,
            severity: FleetAlertSeverity.BLUE,
            type: FleetAlertType.NO_CONVERSIONS,
            message: `${row.site_id} has no conversions`
          })
        }
      }

      return alerts as ReadonlyArray<FleetAlertRow>
    })(),
    mapPostgresError
  )
}
