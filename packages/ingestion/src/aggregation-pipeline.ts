import type { Result } from '@inertia/neverthrow'
import { ok } from '@inertia/neverthrow'
import { safeJsonParse } from './safe-json-parse.js'
import type { ParseFailure } from './safe-json-parse.js'
import { validateDailySummary } from './daily-summary-schema.js'
import type { DailySummaryPayload } from './daily-summary-schema.js'
import type { ValidationFailure } from './schemas.js'
import type { HmacError } from './hmac.js'

export interface AggregationAuditEntry {
  readonly timestamp: number
  readonly code: string
  readonly message: string
}

export type AggregationAuditFn = (entry: AggregationAuditEntry) => void

export type VerifyFn = (secret: string, body: string, signature: string) => Result<true, HmacError>
export type AggregationPersistFn = (payload: DailySummaryPayload) => Result<number, { code: string; message: string }>

type AggregationError = ParseFailure | ValidationFailure | HmacError

function auditFailure (audit: AggregationAuditFn | undefined, failure: AggregationError): void {
  if (audit === undefined) return
  audit({
    timestamp: Date.now(),
    code: failure.code,
    message: failure.message
  })
}

export interface AggregationResult {
  readonly ok: true
}

const SUCCESS: AggregationResult = { ok: true }

export function createAggregationPipeline (
  verify: (secret: string, body: string, signature: string) => Result<true, HmacError>,
  persist: (payload: DailySummaryPayload) => Result<number, { code: string; message: string }>,
  audit?: AggregationAuditFn
): (body: string, signature: string) => Result<AggregationResult, never> {
  return (body: string, signature: string): Result<AggregationResult, never> => {
    const verifyResult = verify('', body, signature)
    if (verifyResult.isErr()) {
      auditFailure(audit, verifyResult.error)
      return ok(SUCCESS)
    }

    const parseResult = safeJsonParse(body)
    if (parseResult.isErr()) {
      auditFailure(audit, parseResult.error)
      return ok(SUCCESS)
    }

    const validateResult = validateDailySummary(parseResult.value)
    if (validateResult.isErr()) {
      auditFailure(audit, validateResult.error)
      return ok(SUCCESS)
    }

    const persistResult = persist(validateResult.value)
    if (persistResult.isErr()) {
      auditFailure(audit, persistResult.error as AggregationError)
      return ok(SUCCESS)
    }

    return ok(SUCCESS)
  }
}
