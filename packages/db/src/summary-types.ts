// Summary table row types — consumed by HUD data fetchers

export interface SessionSummaryRow {
  readonly id: number
  readonly period_start: Date
  readonly period_end: Date
  readonly total_sessions: number
  readonly unique_referrers: number
  readonly device_mobile: number
  readonly device_desktop: number
  readonly device_tablet: number
  readonly created_at: Date
}

export interface EventSummaryRow {
  readonly id: number
  readonly period_start: Date
  readonly period_end: Date
  readonly event_category: string
  readonly total_count: number
  readonly unique_sessions: number
  readonly created_at: Date
}

export interface ConversionSummaryRow {
  readonly id: number
  readonly period_start: Date
  readonly period_end: Date
  readonly intent_type: string
  readonly total_count: number
  readonly top_sources: ReadonlyArray<{ readonly referrer: string; readonly count: number }>
  readonly created_at: Date
}

export interface IngestionHealthRow {
  readonly id: number
  readonly period_start: Date
  readonly payloads_accepted: number
  readonly payloads_rejected: number
  readonly avg_processing_ms: number
  readonly buffer_saturation_pct: number
  readonly created_at: Date
}

export interface SummaryPeriod {
  readonly start: Date
  readonly end: Date
}
