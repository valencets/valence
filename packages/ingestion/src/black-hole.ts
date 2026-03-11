import { createIngestionPipeline } from './pipeline.js'
import type { PersistFn } from './pipeline.js'

export interface IngestionResponse {
  readonly status: 200
  readonly body: string
}

export interface AuditEntry {
  readonly timestamp: number
  readonly code: string
  readonly message: string
  readonly raw: string | undefined
}

export type AuditFn = (entry: AuditEntry) => void

export function createIngestionHandler (
  persist: PersistFn,
  audit: AuditFn
): (requestBody: string) => IngestionResponse {
  const pipeline = createIngestionPipeline(persist)

  return (requestBody: string): IngestionResponse => {
    const result = pipeline(requestBody)

    return result.match(
      (pipelineResult): IngestionResponse => ({
        status: 200,
        body: JSON.stringify({ ok: true, persisted: pipelineResult.persisted })
      }),
      (failure): IngestionResponse => {
        audit({
          timestamp: Date.now(),
          code: failure.code,
          message: failure.message,
          raw: failure.code === 'PARSE_FAILURE' ? failure.raw : undefined
        })

        return {
          status: 200,
          body: JSON.stringify({ ok: true })
        }
      }
    )
  }
}
