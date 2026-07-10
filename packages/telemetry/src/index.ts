// Summary types
export type {
  SessionSummaryRow,
  EventSummaryRow,
  ConversionSummaryRow,
  IngestionHealthRow,
  SummaryPeriod
} from './summary-types.js'

// Daily summary types
export type {
  DailySummaryRow,
  InsertableDailySummary,
  DailySummaryPayload,
  DailyBreakdowns,
  TopReferrerEntry,
  TopPageEntry
} from './daily-summary-types.js'

// Aggregation queries (session/event/conversion summaries)
export {
  aggregateSessionSummary,
  aggregateEventSummary,
  aggregateConversionSummary
} from './aggregation.js'

// Summary read queries
export {
  getSessionSummaries,
  getEventSummaries,
  getConversionSummaries,
  getIngestionHealth,
  insertIngestionHealth
} from './summary-queries.js'

// Daily summary aggregation
export { generateDailySummary } from './daily-summary-aggregation.js'

// Daily summary queries
export {
  getDailySummary,
  getUnsyncedDailySummaries,
  markSynced,
  insertDailySummaryFromRemote,
  getDailyTrend,
  getDailyBreakdowns
} from './daily-summary-queries.js'

// Beacon types
export {
  BeaconIntentType,
  BeaconValidationErrorCode,
  MAX_BEACON_EVENTS,
  PAGEVIEW_CATEGORIES,
  CONVERSION_CATEGORIES,
  isValidIntentType
} from './beacon-types.js'
export type { BeaconEvent, BeaconValidationError } from './beacon-types.js'

// Beacon validation
export { validateBeaconPayload } from './beacon-validation.js'

// Ingestion
export { ingestBeacon } from './ingestion.js'
export type { IngestResult } from './ingestion.js'

// Event types (migrated from @valencets/db)
export type { SessionRow, EventRow, InsertableSession, InsertableEvent } from './event-types.js'

// Event queries (migrated from @valencets/db)
export {
  getSessionById,
  insertEvent,
  insertEvents,
  getEventsBySession,
  getEventsByTimeRange
} from './event-queries.js'

// #337 — `createSession` collides with @valencets/cms's auth-session
// export (same name, unrelated semantics). The analytics session creator
// carries an unambiguous primary name.
export { createSession as createTelemetrySession } from './event-queries.js'

/** @deprecated Use `createTelemetrySession` — this name collides with the
 *  cms auth-session export and will be removed in 2.0. */
export { createSession } from './event-queries.js'

// Client initialization
export { initTelemetry } from './init.js'
export type { TelemetryConfig, TelemetryHandle } from './init.js'

// Server ingestion handler
export { createIngestionHandler } from './handler.js'
export type { IngestionHandlerConfig } from './handler.js'

// Analytics queries
export { getEventCategorySummaries, getEventCountsByCategory, getPageviewsByPath, getDailyEventCounts } from './analytics-queries.js'
export type { CategoryCount, PageviewCount, EventCategorySummary, DailyEventCount } from './analytics-queries.js'
// Server-side event logger
export { createServerEventLogger } from './server-events.js'
export type { ServerEventLogger } from './server-events.js'

// Data retention
export { cleanupOldEvents, cleanupOldSessions } from './retention.js'
