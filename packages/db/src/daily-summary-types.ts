// Daily summary types — one denormalized row per site per day for fleet aggregation

export interface TopReferrerEntry {
  readonly referrer: string
  readonly count: number
}

export interface TopPageEntry {
  readonly path: string
  readonly count: number
}

export interface DailySummaryRow {
  readonly id: number
  readonly site_id: string
  readonly date: Date
  readonly business_type: string
  readonly schema_version: number
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
  readonly top_referrers: ReadonlyArray<TopReferrerEntry> | null
  readonly top_pages: ReadonlyArray<TopPageEntry> | null
  readonly intent_counts: Readonly<Record<string, number>> | null
  readonly avg_flush_ms: number | null
  readonly rejection_count: number | null
  readonly synced_at: Date | null
  readonly created_at: Date
}

export interface InsertableDailySummary {
  readonly site_id: string
  readonly date: Date
  readonly business_type: string
  readonly schema_version: number
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
  readonly top_referrers: ReadonlyArray<TopReferrerEntry> | null
  readonly top_pages: ReadonlyArray<TopPageEntry> | null
  readonly intent_counts: Readonly<Record<string, number>> | null
  readonly avg_flush_ms: number | null
  readonly rejection_count: number | null
  readonly synced_at: Date | null
}

export interface DailySummaryPayload {
  readonly site_id: string
  readonly date: string
  readonly business_type: string
  readonly schema_version: number
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
  readonly top_referrers: ReadonlyArray<TopReferrerEntry> | null
  readonly top_pages: ReadonlyArray<TopPageEntry> | null
  readonly intent_counts: Readonly<Record<string, number>> | null
  readonly avg_flush_ms: number | null
  readonly rejection_count: number | null
}
