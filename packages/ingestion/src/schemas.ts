import { ok, err } from '@inertia/neverthrow'
import type { Result } from '@inertia/neverthrow'
import { z } from 'zod'

export const INTENT_TYPES = [
  'CLICK', 'SCROLL', 'VIEWPORT_INTERSECT', 'FORM_INPUT',
  'INTENT_NAVIGATE', 'INTENT_CALL', 'INTENT_BOOK', 'INTENT_LEAD',
  'LEAD_PHONE', 'LEAD_EMAIL', 'LEAD_FORM'
] as const

export type IntentTypeValue = typeof INTENT_TYPES[number]

export interface ValidatedIntent {
  readonly id: string
  readonly timestamp: number
  readonly type: IntentTypeValue
  readonly targetDOMNode: string
  readonly x_coord: number
  readonly y_coord: number
  readonly schema_version: number
  readonly path?: string
  readonly referrer?: string
}

export type ValidatedTelemetryPayload = ReadonlyArray<ValidatedIntent>

export interface ValidationFailure {
  readonly code: 'VALIDATION_FAILURE'
  readonly message: string
  readonly issues: ReadonlyArray<{ readonly path: string; readonly message: string }>
}

const finiteNumber = z.number().refine(
  (n) => Number.isFinite(n),
  { message: 'Must be a finite number' }
)

const intentSchema = z.object({
  id: z.string(),
  timestamp: finiteNumber,
  type: z.enum(INTENT_TYPES),
  targetDOMNode: z.string(),
  x_coord: finiteNumber,
  y_coord: finiteNumber,
  schema_version: z.literal(1),
  path: z.string().optional(),
  referrer: z.string().optional()
})

const telemetryPayloadSchema = z.array(intentSchema)

export function validateTelemetryPayload (data: unknown): Result<ValidatedTelemetryPayload, ValidationFailure> {
  const parsed = telemetryPayloadSchema.safeParse(data)

  if (parsed.success) {
    return ok(parsed.data as ValidatedTelemetryPayload)
  }

  const issues = parsed.error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message
  }))

  return err({
    code: 'VALIDATION_FAILURE',
    message: `Payload validation failed with ${issues.length} issue(s)`,
    issues
  })
}
