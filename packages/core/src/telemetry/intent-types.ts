export const IntentType = Object.freeze({
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
} as const)

export type IntentType = typeof IntentType[keyof typeof IntentType]

export const TelemetryErrorCode = Object.freeze({
  BUFFER_FULL: 'BUFFER_FULL',
  POOL_EXHAUSTED: 'POOL_EXHAUSTED',
  FLUSH_EMPTY: 'FLUSH_EMPTY',
  FLUSH_DISPATCH_FAILED: 'FLUSH_DISPATCH_FAILED',
  FLUSH_CONSENT_DENIED: 'FLUSH_CONSENT_DENIED',
  FLUSH_OVERFLOW: 'FLUSH_OVERFLOW',
  INVALID_CAPACITY: 'INVALID_CAPACITY',
  INVALID_INTENT_TYPE: 'INVALID_INTENT_TYPE',
  INVALID_SLOT_INDEX: 'INVALID_SLOT_INDEX',
  NO_TELEMETRY_ATTRIBUTE: 'NO_TELEMETRY_ATTRIBUTE'
} as const)

export type TelemetryErrorCode = typeof TelemetryErrorCode[keyof typeof TelemetryErrorCode]

export const BusinessType = Object.freeze({
  BARBERSHOP: 'barbershop',
  LEGAL: 'legal',
  HVAC: 'hvac',
  MEDICAL: 'medical',
  RESTAURANT: 'restaurant',
  CONTRACTOR: 'contractor',
  RETAIL: 'retail',
  OTHER: 'other'
} as const)

export type BusinessType = typeof BusinessType[keyof typeof BusinessType]

export const CURRENT_SCHEMA_VERSION = 1

export interface GlobalTelemetryIntent {
  id: string
  timestamp: number
  type: IntentType
  targetDOMNode: string
  x_coord: number
  y_coord: number
  isDirty: boolean
  schema_version: number
  site_id: string
  business_type: BusinessType
  path: string
  referrer: string
}

export interface TelemetryError {
  readonly code: TelemetryErrorCode
  readonly message: string
}

export function resetIntent (slot: GlobalTelemetryIntent): void {
  slot.timestamp = 0
  slot.type = IntentType.CLICK
  slot.targetDOMNode = ''
  slot.x_coord = 0
  slot.y_coord = 0
  slot.isDirty = false
  slot.schema_version = CURRENT_SCHEMA_VERSION
  slot.site_id = ''
  slot.business_type = BusinessType.OTHER
  slot.path = ''
  slot.referrer = ''
}

export function createEmptyIntent (id: string): GlobalTelemetryIntent {
  return {
    id,
    timestamp: 0,
    type: IntentType.CLICK,
    targetDOMNode: '',
    x_coord: 0,
    y_coord: 0,
    isDirty: false,
    schema_version: CURRENT_SCHEMA_VERSION,
    site_id: '',
    business_type: BusinessType.OTHER,
    path: '',
    referrer: ''
  }
}
