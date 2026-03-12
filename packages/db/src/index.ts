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
  TopReferrerEntry,
  TopPageEntry
} from './daily-summary-types.js'
