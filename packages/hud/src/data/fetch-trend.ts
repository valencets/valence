import { ResultAsync } from 'neverthrow'
import type { HudPeriod, HudError, TrendData } from '../types.js'
import { HudErrorCode } from '../types.js'

function mapFetchError (e: unknown): HudError {
  return {
    code: HudErrorCode.FETCH_FAILED,
    message: e instanceof Error ? e.message : 'Fetch failed'
  }
}

function buildUrl (base: string, path: string, period: HudPeriod, site?: string): string {
  const siteParam = site !== undefined && site !== '' ? `&site=${site}` : ''
  return `${base}${path}?period=${period}${siteParam}`
}

export function fetchTrendData (baseUrl: string, period: HudPeriod, site?: string): ResultAsync<TrendData, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/summaries/trend', period, site))
      .then(r => r.json() as Promise<TrendData>),
    mapFetchError
  )
}
