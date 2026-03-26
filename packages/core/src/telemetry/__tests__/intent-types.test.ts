import { describe, it, expect } from 'vitest'
import {
  IntentType,
  TelemetryErrorCode,
  BusinessType,
  CURRENT_SCHEMA_VERSION,
  createEmptyIntent,
  resetIntent
} from '../intent-types.js'
import type { GlobalTelemetryIntent } from '../intent-types.js'

describe('IntentType', () => {
  it('contains all expected intent type values', () => {
    expect(IntentType.CLICK).toBe('CLICK')
    expect(IntentType.SCROLL).toBe('SCROLL')
    expect(IntentType.VIEWPORT_INTERSECT).toBe('VIEWPORT_INTERSECT')
    expect(IntentType.FORM_INPUT).toBe('FORM_INPUT')
    expect(IntentType.INTENT_NAVIGATE).toBe('INTENT_NAVIGATE')
    expect(IntentType.INTENT_CALL).toBe('INTENT_CALL')
    expect(IntentType.INTENT_BOOK).toBe('INTENT_BOOK')
    expect(IntentType.INTENT_LEAD).toBe('INTENT_LEAD')
    expect(IntentType.LEAD_PHONE).toBe('LEAD_PHONE')
    expect(IntentType.LEAD_EMAIL).toBe('LEAD_EMAIL')
    expect(IntentType.LEAD_FORM).toBe('LEAD_FORM')
    expect(IntentType.PAGEVIEW).toBe('PAGEVIEW')
  })

  it('all values are strings', () => {
    for (const value of Object.values(IntentType)) {
      expect(typeof value).toBe('string')
    }
  })

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(IntentType)).toBe(true)
  })
})

describe('TelemetryErrorCode', () => {
  it('contains all expected error codes', () => {
    expect(TelemetryErrorCode.BUFFER_FULL).toBe('BUFFER_FULL')
    expect(TelemetryErrorCode.POOL_EXHAUSTED).toBe('POOL_EXHAUSTED')
    expect(TelemetryErrorCode.FLUSH_EMPTY).toBe('FLUSH_EMPTY')
    expect(TelemetryErrorCode.FLUSH_DISPATCH_FAILED).toBe('FLUSH_DISPATCH_FAILED')
    expect(TelemetryErrorCode.FLUSH_CONSENT_DENIED).toBe('FLUSH_CONSENT_DENIED')
    expect(TelemetryErrorCode.FLUSH_OVERFLOW).toBe('FLUSH_OVERFLOW')
    expect(TelemetryErrorCode.INVALID_CAPACITY).toBe('INVALID_CAPACITY')
    expect(TelemetryErrorCode.INVALID_INTENT_TYPE).toBe('INVALID_INTENT_TYPE')
    expect(TelemetryErrorCode.INVALID_SLOT_INDEX).toBe('INVALID_SLOT_INDEX')
    expect(TelemetryErrorCode.NO_TELEMETRY_ATTRIBUTE).toBe('NO_TELEMETRY_ATTRIBUTE')
  })

  it('all values are strings', () => {
    for (const value of Object.values(TelemetryErrorCode)) {
      expect(typeof value).toBe('string')
    }
  })

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(TelemetryErrorCode)).toBe(true)
  })
})

describe('BusinessType', () => {
  it('contains all expected business type values', () => {
    expect(BusinessType.BARBERSHOP).toBe('barbershop')
    expect(BusinessType.LEGAL).toBe('legal')
    expect(BusinessType.HVAC).toBe('hvac')
    expect(BusinessType.MEDICAL).toBe('medical')
    expect(BusinessType.RESTAURANT).toBe('restaurant')
    expect(BusinessType.CONTRACTOR).toBe('contractor')
    expect(BusinessType.RETAIL).toBe('retail')
    expect(BusinessType.OTHER).toBe('other')
  })

  it('all values are strings', () => {
    for (const value of Object.values(BusinessType)) {
      expect(typeof value).toBe('string')
    }
  })

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(BusinessType)).toBe(true)
  })
})

describe('CURRENT_SCHEMA_VERSION', () => {
  it('is 1', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1)
  })
})

describe('createEmptyIntent', () => {
  it('returns an intent with correct defaults', () => {
    const intent = createEmptyIntent('test-0')
    expect(intent.id).toBe('test-0')
    expect(intent.timestamp).toBe(0)
    expect(intent.type).toBe(IntentType.CLICK)
    expect(intent.targetDOMNode).toBe('')
    expect(intent.x_coord).toBe(0)
    expect(intent.y_coord).toBe(0)
    expect(intent.isDirty).toBe(false)
    expect(intent.schema_version).toBe(CURRENT_SCHEMA_VERSION)
    expect(intent.site_id).toBe('')
    expect(intent.business_type).toBe(BusinessType.OTHER)
    expect(intent.path).toBe('')
    expect(intent.referrer).toBe('')
  })

  it('returns isDirty as false', () => {
    const intent = createEmptyIntent('slot-1')
    expect(intent.isDirty).toBe(false)
  })

  it('has property order matching interface declaration', () => {
    const intent = createEmptyIntent('slot-0')
    const keys = Object.keys(intent)
    expect(keys).toEqual([
      'id', 'timestamp', 'type', 'targetDOMNode',
      'x_coord', 'y_coord', 'isDirty', 'schema_version',
      'site_id', 'business_type', 'path', 'referrer'
    ])
  })

  it('satisfies GlobalTelemetryIntent type', () => {
    const intent: GlobalTelemetryIntent = createEmptyIntent('typed-0')
    expect(intent.id).toBe('typed-0')
    expect(typeof intent.site_id).toBe('string')
  })

  it('includes path and referrer fields with empty defaults', () => {
    const intent = createEmptyIntent('path-0')
    expect(intent.path).toBe('')
    expect(intent.referrer).toBe('')
  })
})

describe('resetIntent', () => {
  it('resets all fields except id', () => {
    const intent = createEmptyIntent('slot-0')
    intent.timestamp = 12345
    intent.type = IntentType.SCROLL
    intent.targetDOMNode = 'button.cta'
    intent.x_coord = 100
    intent.y_coord = 200
    intent.isDirty = true
    intent.schema_version = 99
    intent.site_id = 'site-abc'
    intent.business_type = BusinessType.LEGAL
    intent.path = '/about'
    intent.referrer = 'https://example.com'

    resetIntent(intent)

    expect(intent.id).toBe('slot-0')
    expect(intent.timestamp).toBe(0)
    expect(intent.type).toBe(IntentType.CLICK)
    expect(intent.targetDOMNode).toBe('')
    expect(intent.x_coord).toBe(0)
    expect(intent.y_coord).toBe(0)
    expect(intent.isDirty).toBe(false)
    expect(intent.schema_version).toBe(CURRENT_SCHEMA_VERSION)
    expect(intent.site_id).toBe('')
    expect(intent.business_type).toBe(BusinessType.OTHER)
    expect(intent.path).toBe('')
    expect(intent.referrer).toBe('')
  })

  it('preserves object identity after reset', () => {
    const intent = createEmptyIntent('slot-0')
    const ref = intent
    resetIntent(intent)
    expect(intent).toBe(ref)
  })
})
