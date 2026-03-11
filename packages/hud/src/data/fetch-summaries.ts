import { ResultAsync } from 'neverthrow'
import type { HudPeriod, HudError, SessionSummary, EventSummary, ConversionSummary, IngestionHealth } from '../types.js'
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

export function fetchSessionSummary (baseUrl: string, period: HudPeriod): ResultAsync<SessionSummary, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/summaries/sessions', period))
      .then(r => r.json() as Promise<SessionSummary>),
    mapFetchError
  )
}

export function fetchEventSummary (baseUrl: string, period: HudPeriod): ResultAsync<EventSummary, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/summaries/events', period))
      .then(r => r.json() as Promise<EventSummary>),
    mapFetchError
  )
}

export function fetchConversionSummary (baseUrl: string, period: HudPeriod): ResultAsync<ConversionSummary, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/summaries/conversions', period))
      .then(r => r.json() as Promise<ConversionSummary>),
    mapFetchError
  )
}

export function fetchIngestionHealth (baseUrl: string, period: HudPeriod): ResultAsync<IngestionHealth, HudError> {
  return ResultAsync.fromPromise(
    fetch(buildUrl(baseUrl, '/api/diagnostics/ingestion', period))
      .then(r => r.json() as Promise<IngestionHealth>),
    mapFetchError
  )
}
