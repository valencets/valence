// Barrel export — named exports only, no default exports
export { safeJsonParse } from './safe-json-parse.js'
export type { ParseFailure } from './safe-json-parse.js'
export { validateTelemetryPayload, INTENT_TYPES } from './schemas.js'
export type { ValidationFailure, ValidatedTelemetryPayload, ValidatedIntent, IntentTypeValue } from './schemas.js'
export { createIngestionPipeline } from './pipeline.js'
export type { PersistFn, PersistFailure, IngestionError, PipelineResult } from './pipeline.js'
export { createIngestionHandler } from './black-hole.js'
export type { IngestionResponse, AuditEntry, AuditFn } from './black-hole.js'
