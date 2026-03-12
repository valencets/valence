import { ResultAsync } from 'neverthrow'
import type { HudError } from '../types.js'
import { HudErrorCode } from '../types.js'

export interface FleetSiteData {
  readonly site_id: string
  readonly business_type: string
  readonly date: string
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
  readonly status: string
  readonly last_synced: string | null
}

export interface FleetComparisonData {
  readonly business_type: string
  readonly avg_sessions: number
  readonly avg_conversions: number
  readonly top_performer_site_id: string
  readonly sparkline_data: ReadonlyArray<number>
}

function mapFetchError (e: unknown): HudError {
  return {
    code: HudErrorCode.FETCH_FAILED,
    message: e instanceof Error ? e.message : 'Fetch failed'
  }
}

export function fetchFleetSites (baseUrl: string): ResultAsync<ReadonlyArray<FleetSiteData>, HudError> {
  return ResultAsync.fromPromise(
    fetch(`${baseUrl}/api/fleet/sites`)
      .then(r => r.json() as Promise<ReadonlyArray<FleetSiteData>>),
    mapFetchError
  )
}

export interface FleetAggregateData {
  readonly total_sites: number
  readonly total_sessions: number
  readonly total_conversions: number
}

export function fetchFleetAggregates (baseUrl: string): ResultAsync<FleetAggregateData, HudError> {
  return ResultAsync.fromPromise(
    fetch(`${baseUrl}/api/fleet/aggregates`)
      .then(r => r.json() as Promise<FleetAggregateData>),
    mapFetchError
  )
}

export function fetchFleetComparison (baseUrl: string, businessType: string): ResultAsync<ReadonlyArray<FleetComparisonData>, HudError> {
  return ResultAsync.fromPromise(
    fetch(`${baseUrl}/api/fleet/compare?type=${businessType}`)
      .then(r => r.json() as Promise<ReadonlyArray<FleetComparisonData>>),
    mapFetchError
  )
}
