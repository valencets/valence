// Barrel export — named exports only, no default exports
export { DbErrorCode } from './types.js'
export type { DbError, SessionRow, EventRow, InsertableSession, InsertableEvent, DbConfig } from './types.js'
export { validateDbConfig, createPool, closePool, mapPostgresError } from './connection.js'
export type { DbPool } from './connection.js'
export { createSession, getSessionById, insertEvents, insertEvent, getEventsBySession, getEventsByTimeRange } from './queries.js'
export { loadMigrations, runMigrations, getMigrationStatus, parseMigrationFilename, sortMigrations, validateMigrations } from './migration-runner.js'
export type { MigrationFile } from './migration-runner.js'

// Summary tables
export type {
  SessionSummaryRow,
  EventSummaryRow,
  ConversionSummaryRow,
  IngestionHealthRow,
  SummaryPeriod
} from './summary-types.js'
export { aggregateSessionSummary, aggregateEventSummary, aggregateConversionSummary } from './aggregation.js'
export { getSessionSummaries, getEventSummaries, getConversionSummaries, getIngestionHealth, insertIngestionHealth } from './summary-queries.js'

// Daily summaries (fleet aggregation)
export type {
  DailySummaryRow,
  InsertableDailySummary,
  DailySummaryPayload,
  DailyBreakdowns,
  TopReferrerEntry,
  TopPageEntry
} from './daily-summary-types.js'
export { generateDailySummary } from './daily-summary-aggregation.js'
export { getDailySummary, getUnsyncedDailySummaries, markSynced, insertDailySummaryFromRemote, getDailyBreakdowns } from './daily-summary-queries.js'

// Fleet queries
export { getFleetSites, getFleetComparison, getFleetSiteHistory, getFleetAggregates, getFleetAlerts, FleetSiteStatus, FleetAlertSeverity, FleetAlertType } from './fleet-queries.js'
export type { FleetSiteRow, FleetComparisonRow, FleetFilter, FleetSort, FleetAggregateRow, FleetAlertRow } from './fleet-queries.js'

// Sites registry
export { Vertical, Tier } from './site-types.js'
export type { SiteRow, InsertableSite } from './site-types.js'
export { getSites, getSiteBySlug, upsertSite } from './site-queries.js'
