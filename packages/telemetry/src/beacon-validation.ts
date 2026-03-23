import { ok, err, fromThrowable } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import {
  BeaconValidationErrorCode,
  MAX_BEACON_EVENTS,
  isValidIntentType
} from './beacon-types.js'
import type { BeaconEvent, BeaconValidationError, BeaconIntentType } from './beacon-types.js'

const REQUIRED_STRING_FIELDS = ['id', 'targetDOMNode', 'site_id', 'business_type', 'path', 'referrer'] as const
interface RawBeaconInput {
  readonly [key: string]: string | number | boolean | null | undefined
}

const REQUIRED_NUMBER_FIELDS = ['timestamp', 'x_coord', 'y_coord', 'schema_version'] as const

function validateEvent (raw: RawBeaconInput, index: number): Result<BeaconEvent, BeaconValidationError> {
  // Check required string fields exist
  for (const field of REQUIRED_STRING_FIELDS) {
    if (raw[field] === undefined || raw[field] === null) {
      return err({
        code: BeaconValidationErrorCode.MISSING_FIELD,
        message: `Event ${index}: missing required field "${field}"`
      })
    }
    if (typeof raw[field] !== 'string') {
      return err({
        code: BeaconValidationErrorCode.INVALID_FIELD_TYPE,
        message: `Event ${index}: "${field}" must be a string`
      })
    }
  }

  // Check required number fields exist
  for (const field of REQUIRED_NUMBER_FIELDS) {
    if (raw[field] === undefined || raw[field] === null) {
      return err({
        code: BeaconValidationErrorCode.MISSING_FIELD,
        message: `Event ${index}: missing required field "${field}"`
      })
    }
    if (typeof raw[field] !== 'number') {
      return err({
        code: BeaconValidationErrorCode.INVALID_FIELD_TYPE,
        message: `Event ${index}: "${field}" must be a number`
      })
    }
  }

  // Check type field exists and is valid
  if (raw.type === undefined || raw.type === null) {
    return err({
      code: BeaconValidationErrorCode.MISSING_FIELD,
      message: `Event ${index}: missing required field "type"`
    })
  }

  const typeStr = String(raw.type)
  if (!isValidIntentType(typeStr)) {
    return err({
      code: BeaconValidationErrorCode.INVALID_INTENT_TYPE,
      message: `Event ${index}: invalid intent type "${typeStr}"`
    })
  }

  // Validate site_id is non-empty
  if ((raw.site_id as string).length === 0) {
    return err({
      code: BeaconValidationErrorCode.INVALID_SITE_ID,
      message: `Event ${index}: site_id must be non-empty`
    })
  }

  // Validate schema_version is a positive integer
  const schemaVersion = raw.schema_version as number
  if (schemaVersion <= 0 || !Number.isInteger(schemaVersion)) {
    return err({
      code: BeaconValidationErrorCode.INVALID_SCHEMA_VERSION,
      message: `Event ${index}: schema_version must be a positive integer`
    })
  }

  // Validate timestamp is positive
  const timestamp = raw.timestamp as number
  if (timestamp < 0) {
    return err({
      code: BeaconValidationErrorCode.INVALID_FIELD_TYPE,
      message: `Event ${index}: timestamp must be non-negative`
    })
  }

  // Build validated BeaconEvent (strip isDirty and any extra fields)
  return ok({
    id: raw.id as string,
    timestamp,
    type: typeStr as BeaconIntentType,
    targetDOMNode: raw.targetDOMNode as string,
    x_coord: raw.x_coord as number,
    y_coord: raw.y_coord as number,
    schema_version: schemaVersion,
    site_id: raw.site_id as string,
    business_type: raw.business_type as string,
    path: raw.path as string,
    referrer: raw.referrer as string
  })
}

/** JSON parse boundary — single safeJsonParse equivalent using fromThrowable. */
const safeJsonParse = fromThrowable(
  JSON.parse,
  (): BeaconValidationError => ({
    code: BeaconValidationErrorCode.INVALID_JSON,
    message: 'Failed to parse JSON payload'
  })
)

export function validateBeaconPayload (raw: string): Result<ReadonlyArray<BeaconEvent>, BeaconValidationError> {
  const parseResult = safeJsonParse(raw)
  if (parseResult.isErr()) return err(parseResult.error)
  const parsed = parseResult.value

  if (!Array.isArray(parsed)) {
    return err({
      code: BeaconValidationErrorCode.NOT_AN_ARRAY,
      message: 'Payload must be a JSON array'
    })
  }

  if (parsed.length === 0) {
    return err({
      code: BeaconValidationErrorCode.EMPTY_PAYLOAD,
      message: 'Payload array must contain at least one event'
    })
  }

  if (parsed.length > MAX_BEACON_EVENTS) {
    return err({
      code: BeaconValidationErrorCode.PAYLOAD_TOO_LARGE,
      message: `Payload exceeds maximum of ${MAX_BEACON_EVENTS} events (got ${parsed.length})`
    })
  }

  const events: BeaconEvent[] = []
  for (let i = 0; i < parsed.length; i++) {
    const item = parsed[i]
    if (typeof item !== 'object' || item === null) {
      return err({
        code: BeaconValidationErrorCode.INVALID_FIELD_TYPE,
        message: `Event ${i}: must be an object`
      })
    }
    const result = validateEvent(item as RawBeaconInput, i)
    if (result.isErr()) return err(result.error)
    events.push(result.value)
  }

  return ok(events as ReadonlyArray<BeaconEvent>)
}
