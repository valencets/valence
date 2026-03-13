export const HudErrorCode = {
  FETCH_FAILED: 'FETCH_FAILED',
  INVALID_PERIOD: 'INVALID_PERIOD',
  RENDER_FAILED: 'RENDER_FAILED'
} as const

export type HudErrorCode = typeof HudErrorCode[keyof typeof HudErrorCode]

export interface HudError {
  readonly code: HudErrorCode
  readonly message: string
}

export const HudPeriod = {
  TODAY: 'TODAY',
  '7D': '7D',
  '30D': '30D',
  '90D': '90D'
} as const

export type HudPeriod = typeof HudPeriod[keyof typeof HudPeriod]

export interface DeltaResult {
  readonly value: string
  readonly direction: 'up' | 'down' | 'flat'
}

export interface DeviceBreakdown {
  readonly mobile: number
  readonly desktop: number
  readonly tablet: number
}

export interface SessionSummary {
  readonly period_start: string
  readonly period_end: string
  readonly total_sessions: number
  readonly unique_referrers: number
  readonly device_breakdown: DeviceBreakdown
}

export interface EventSummary {
  readonly period_start: string
  readonly period_end: string
  readonly event_category: string
  readonly total_count: number
  readonly unique_sessions: number
}

export interface ConversionSummary {
  readonly period_start: string
  readonly period_end: string
  readonly intent_type: string
  readonly total_count: number
  readonly top_sources: ReadonlyArray<{
    readonly referrer: string
    readonly count: number
  }>
}

export interface IngestionHealth {
  readonly period_start: string
  readonly payloads_accepted: number
  readonly payloads_rejected: number
  readonly avg_processing_ms: number
  readonly buffer_saturation_pct: number
}

export type ReferrerCategory = 'Search' | 'Direct' | 'Social' | 'Referral' | 'Paid' | 'Other'

export interface TopPagesData {
  readonly pages: ReadonlyArray<{ readonly path: string; readonly count: number }>
}

export interface TrafficSourcesData {
  readonly sources: ReadonlyArray<{
    readonly category: ReferrerCategory
    readonly count: number
    readonly percent: number
  }>
}

export interface LeadActionsData {
  readonly actions: ReadonlyArray<{ readonly action: string; readonly count: number }>
}

export interface TrendDayPoint {
  readonly date: string
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
}

export interface TrendData {
  readonly days: ReadonlyArray<TrendDayPoint>
}
