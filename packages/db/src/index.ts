// Barrel export — named exports only, no default exports
export { DbErrorCode } from './types.js'
export type { DbError, SessionRow, EventRow, InsertableSession, InsertableEvent, DbConfig } from './types.js'
export { validateDbConfig, createPool, closePool, mapPostgresError } from './connection.js'
export type { DbPool } from './connection.js'
export { createSession, getSessionById, insertEvents, insertEvent, getEventsBySession, getEventsByTimeRange } from './queries.js'
export { loadMigrations, runMigrations, getMigrationStatus, parseMigrationFilename, sortMigrations, validateMigrations } from './migration-runner.js'
export type { MigrationFile } from './migration-runner.js'
