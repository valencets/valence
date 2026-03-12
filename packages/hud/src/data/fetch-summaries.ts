import { ResultAsync } from 'neverthrow'
import type { HudPeriod, HudError, SessionSummary, EventSummary, ConversionSummary, IngestionHealth } from '../types.js'
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

export function fetchSessionSummary (baseUrl: string, period: HudPeriod, site?: string): ResultAsync<SessionSummary, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/summaries/sessions', period, site))
      .then(r => r.json() as Promise<SessionSummary>),
    mapFetchError
  )
}

export function fetchEventSummary (baseUrl: string, period: HudPeriod, site?: string): ResultAsync<EventSummary, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/summaries/events', period, site))
      .then(r => r.json() as Promise<EventSummary>),
    mapFetchError
  )
}

export function fetchConversionSummary (baseUrl: string, period: HudPeriod, site?: string): ResultAsync<ConversionSummary, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/summaries/conversions', period, site))
      .then(r => r.json() as Promise<ConversionSummary>),
    mapFetchError
  )
}

export function fetchIngestionHealth (baseUrl: string, period: HudPeriod, site?: string): ResultAsync<IngestionHealth, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/diagnostics/ingestion', period, site))
      .then(r => r.json() as Promise<IngestionHealth>),
    mapFetchError
  )
}
