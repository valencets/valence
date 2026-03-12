import { ResultAsync } from 'neverthrow'
import type { HudPeriod, HudError, TopPagesData, TrafficSourcesData, LeadActionsData } from '../types.js'
import { HudErrorCode } from '../types.js'

function mapFetchError (e: unknown): HudError {
  return {
    code: HudErrorCode.FETCH_FAILED,
    message: e instanceof Error ? e.message : 'Fetch failed'
  }
}

function buildUrl (base: string, path: string, period: HudPeriod): string {
  return `${base}${path}?period=${period}`
}

export function fetchTopPages (baseUrl: string, period: HudPeriod): ResultAsync<TopPagesData, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/breakdowns/pages', period))
      .then(r => r.json() as Promise<TopPagesData>),
    mapFetchError
  )
}

export function fetchTrafficSources (baseUrl: string, period: HudPeriod): ResultAsync<TrafficSourcesData, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/breakdowns/sources', period))
      .then(r => r.json() as Promise<TrafficSourcesData>),
    mapFetchError
  )
}

export function fetchLeadActions (baseUrl: string, period: HudPeriod): ResultAsync<LeadActionsData, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/breakdowns/actions', period))
      .then(r => r.json() as Promise<LeadActionsData>),
    mapFetchError
  )
}
