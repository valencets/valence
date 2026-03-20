// Beacon payload types — server-side representation of client telemetry events

export const BeaconIntentType = {
  CLICK: 'CLICK',
  SCROLL: 'SCROLL',
  VIEWPORT_INTERSECT: 'VIEWPORT_INTERSECT',
  FORM_INPUT: 'FORM_INPUT',
  INTENT_NAVIGATE: 'INTENT_NAVIGATE',
  INTENT_CALL: 'INTENT_CALL',
  INTENT_BOOK: 'INTENT_BOOK',
  INTENT_LEAD: 'INTENT_LEAD',
  LEAD_PHONE: 'LEAD_PHONE',
  LEAD_EMAIL: 'LEAD_EMAIL',
  LEAD_FORM: 'LEAD_FORM',
  PAGEVIEW: 'PAGEVIEW'
} as const

export type BeaconIntentType = typeof BeaconIntentType[keyof typeof BeaconIntentType]

const VALID_INTENT_TYPES = new Set<string>(Object.values(BeaconIntentType))

export function isValidIntentType (value: string): value is BeaconIntentType {
  return VALID_INTENT_TYPES.has(value)
}

export interface BeaconEvent {
  readonly id: string
  readonly timestamp: number
  readonly type: BeaconIntentType
  readonly targetDOMNode: string
  readonly x_coord: number
  readonly y_coord: number
  readonly schema_version: number
  readonly site_id: string
  readonly business_type: string
  readonly path: string
  readonly referrer: string
}

export const BeaconValidationErrorCode = {
  INVALID_JSON: 'INVALID_JSON',
  EMPTY_PAYLOAD: 'EMPTY_PAYLOAD',
  NOT_AN_ARRAY: 'NOT_AN_ARRAY',
  INVALID_INTENT_TYPE: 'INVALID_INTENT_TYPE',
  INVALID_SITE_ID: 'INVALID_SITE_ID',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  INVALID_SCHEMA_VERSION: 'INVALID_SCHEMA_VERSION',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FIELD_TYPE: 'INVALID_FIELD_TYPE'
} as const

export type BeaconValidationErrorCode = typeof BeaconValidationErrorCode[keyof typeof BeaconValidationErrorCode]

export interface BeaconValidationError {
  readonly code: BeaconValidationErrorCode
  readonly message: string
}

export const MAX_BEACON_EVENTS = 256
