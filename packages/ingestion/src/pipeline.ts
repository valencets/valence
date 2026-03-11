import type { Result } from 'neverthrow'
import { safeJsonParse } from './safe-json-parse.js'
import type { ParseFailure } from './safe-json-parse.js'
import { validateTelemetryPayload } from './schemas.js'
import type { ValidationFailure, ValidatedTelemetryPayload } from './schemas.js'

export interface PersistFailure {
  readonly code: 'PERSIST_FAILURE'
  readonly message: string
}

export type IngestionError = ParseFailure | ValidationFailure | PersistFailure

export type PersistFn = (payload: ValidatedTelemetryPayload) => Result<number, PersistFailure>

export interface PipelineResult {
  readonly persisted: number
}

export function createIngestionPipeline (
  persist: PersistFn
): (raw: string) => Result<PipelineResult, IngestionError> {
  return (raw: string): Result<PipelineResult, IngestionError> =>
    safeJsonParse(raw)
      .andThen(validateTelemetryPayload)
      .andThen(persist)
      .map((count): PipelineResult => ({ persisted: count }))
}
