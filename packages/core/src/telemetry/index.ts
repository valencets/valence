// Barrel export -- named exports only, no default exports
export { IntentType, TelemetryErrorCode, createEmptyIntent } from './intent-types.js'
export type { GlobalTelemetryIntent, TelemetryError } from './intent-types.js'
export { TelemetryObjectPool } from './object-pool.js'
export { TelemetryRingBuffer } from './ring-buffer.js'
export { initEventDelegation } from './event-delegation.js'
export type { EventDelegationHandle } from './event-delegation.js'
export { flushTelemetry, scheduleAutoFlush } from './flush.js'
export type { FlushHandle } from './flush.js'
