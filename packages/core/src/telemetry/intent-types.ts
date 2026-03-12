export const IntentType = {
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
  LEAD_FORM: 'LEAD_FORM'
} as const

export type IntentType = typeof IntentType[keyof typeof IntentType]

export const BusinessType = [
  'barbershop',
  'legal',
  'hvac',
  'medical',
  'restaurant',
  'contractor',
  'retail',
  'other'
] as const

export type BusinessType = typeof BusinessType[number]

export const TelemetryErrorCode = {
  BUFFER_FULL: 'BUFFER_FULL',
  POOL_EXHAUSTED: 'POOL_EXHAUSTED',
  FLUSH_EMPTY: 'FLUSH_EMPTY',
  FLUSH_DISPATCH_FAILED: 'FLUSH_DISPATCH_FAILED',
  INVALID_CAPACITY: 'INVALID_CAPACITY',
  INVALID_INTENT_TYPE: 'INVALID_INTENT_TYPE',
  NO_TELEMETRY_ATTRIBUTE: 'NO_TELEMETRY_ATTRIBUTE'
} as const

export type TelemetryErrorCode = typeof TelemetryErrorCode[keyof typeof TelemetryErrorCode]

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

export function createEmptyIntent (id: string): GlobalTelemetryIntent {
  return {
    id,
    timestamp: 0,
    type: IntentType.CLICK,
    targetDOMNode: '',
    x_coord: 0,
    y_coord: 0,
    isDirty: false,
    schema_version: 1,
    site_id: '',
    business_type: 'other',
    path: '',
    referrer: ''
  }
}
