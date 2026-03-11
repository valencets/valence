import { describe, it, expect } from 'vitest'
import {
  IntentType,
  TelemetryErrorCode,
  createEmptyIntent
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
  })

  it('all values are strings', () => {
    for (const value of Object.values(IntentType)) {
      expect(typeof value).toBe('string')
    }
  })
})

describe('TelemetryErrorCode', () => {
  it('contains all expected error codes', () => {
    expect(TelemetryErrorCode.BUFFER_FULL).toBe('BUFFER_FULL')
    expect(TelemetryErrorCode.POOL_EXHAUSTED).toBe('POOL_EXHAUSTED')
    expect(TelemetryErrorCode.FLUSH_EMPTY).toBe('FLUSH_EMPTY')
    expect(TelemetryErrorCode.FLUSH_DISPATCH_FAILED).toBe('FLUSH_DISPATCH_FAILED')
    expect(TelemetryErrorCode.INVALID_CAPACITY).toBe('INVALID_CAPACITY')
    expect(TelemetryErrorCode.INVALID_INTENT_TYPE).toBe('INVALID_INTENT_TYPE')
    expect(TelemetryErrorCode.NO_TELEMETRY_ATTRIBUTE).toBe('NO_TELEMETRY_ATTRIBUTE')
  })

  it('all values are strings', () => {
    for (const value of Object.values(TelemetryErrorCode)) {
      expect(typeof value).toBe('string')
    }
  })
})

describe('createEmptyIntent', () => {
  it('returns an intent with all 8 properties and correct defaults', () => {
    const intent = createEmptyIntent('test-0')
    expect(intent.id).toBe('test-0')
    expect(intent.timestamp).toBe(0)
    expect(intent.type).toBe(IntentType.CLICK)
    expect(intent.targetDOMNode).toBe('')
    expect(intent.x_coord).toBe(0)
    expect(intent.y_coord).toBe(0)
    expect(intent.isDirty).toBe(false)
    expect(intent.schema_version).toBe(1)
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
      'x_coord', 'y_coord', 'isDirty', 'schema_version'
    ])
  })

  it('satisfies GlobalTelemetryIntent type', () => {
    const intent: GlobalTelemetryIntent = createEmptyIntent('typed-0')
    expect(intent.id).toBe('typed-0')
  })
})
