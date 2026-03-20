import { describe, it, expect } from 'vitest'
import { validateBeaconPayload } from '../beacon-validation.js'
import { BeaconValidationErrorCode, MAX_BEACON_EVENTS } from '../beacon-types.js'

function makeValidEvent (overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt-001',
    timestamp: Date.now(),
    type: 'CLICK',
    targetDOMNode: 'button.cta',
    x_coord: 100,
    y_coord: 200,
    schema_version: 1,
    site_id: 'site-abc',
    business_type: 'dental',
    path: '/home',
    referrer: 'google.com',
    ...overrides
  }
}

describe('validateBeaconPayload', () => {
  describe('valid payloads', () => {
    it('accepts a single valid event', () => {
      const payload = JSON.stringify([makeValidEvent()])
      const result = validateBeaconPayload(payload)
      expect(result.isOk()).toBe(true)
      const events = result._unsafeUnwrap()
      expect(events).toHaveLength(1)
      expect(events[0]!.type).toBe('CLICK')
      expect(events[0]!.site_id).toBe('site-abc')
    })

    it('accepts multiple valid events', () => {
      const payload = JSON.stringify([
        makeValidEvent({ id: 'evt-001', type: 'CLICK' }),
        makeValidEvent({ id: 'evt-002', type: 'SCROLL' }),
        makeValidEvent({ id: 'evt-003', type: 'LEAD_FORM' })
      ])
      const result = validateBeaconPayload(payload)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toHaveLength(3)
    })

    it('accepts all valid intent types', () => {
      const types = [
        'CLICK', 'SCROLL', 'VIEWPORT_INTERSECT', 'FORM_INPUT',
        'INTENT_NAVIGATE', 'INTENT_CALL', 'INTENT_BOOK', 'INTENT_LEAD',
        'LEAD_PHONE', 'LEAD_EMAIL', 'LEAD_FORM', 'PAGEVIEW'
      ]
      for (const type of types) {
        const payload = JSON.stringify([makeValidEvent({ type })])
        const result = validateBeaconPayload(payload)
        expect(result.isOk()).toBe(true)
      }
    })

    it('strips isDirty field from client events', () => {
      const payload = JSON.stringify([makeValidEvent({ isDirty: true })])
      const result = validateBeaconPayload(payload)
      expect(result.isOk()).toBe(true)
      const event = result._unsafeUnwrap()[0]!
      expect('isDirty' in event).toBe(false)
    })
  })

  describe('invalid JSON', () => {
    it('rejects non-JSON string', () => {
      const result = validateBeaconPayload('not json')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_JSON)
    })
  })

  describe('empty payload', () => {
    it('rejects empty array', () => {
      const result = validateBeaconPayload('[]')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.EMPTY_PAYLOAD)
    })
  })

  describe('not an array', () => {
    it('rejects object payload', () => {
      const result = validateBeaconPayload(JSON.stringify({ type: 'CLICK' }))
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.NOT_AN_ARRAY)
    })

    it('rejects string payload', () => {
      const result = validateBeaconPayload('"hello"')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.NOT_AN_ARRAY)
    })
  })

  describe('payload size limit', () => {
    it('rejects payloads exceeding max events', () => {
      const events = Array.from({ length: MAX_BEACON_EVENTS + 1 }, (_, i) =>
        makeValidEvent({ id: `evt-${i}` })
      )
      const result = validateBeaconPayload(JSON.stringify(events))
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.PAYLOAD_TOO_LARGE)
    })

    it('accepts exactly max events', () => {
      const events = Array.from({ length: MAX_BEACON_EVENTS }, (_, i) =>
        makeValidEvent({ id: `evt-${i}` })
      )
      const result = validateBeaconPayload(JSON.stringify(events))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toHaveLength(MAX_BEACON_EVENTS)
    })
  })

  describe('invalid intent type', () => {
    it('rejects unknown intent type', () => {
      const payload = JSON.stringify([makeValidEvent({ type: 'UNKNOWN_TYPE' })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_INTENT_TYPE)
    })
  })

  describe('invalid site_id', () => {
    it('rejects empty site_id', () => {
      const payload = JSON.stringify([makeValidEvent({ site_id: '' })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_SITE_ID)
    })

    it('rejects non-string site_id', () => {
      const payload = JSON.stringify([makeValidEvent({ site_id: 123 })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
    })
  })

  describe('invalid schema_version', () => {
    it('rejects zero schema_version', () => {
      const payload = JSON.stringify([makeValidEvent({ schema_version: 0 })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_SCHEMA_VERSION)
    })

    it('rejects negative schema_version', () => {
      const payload = JSON.stringify([makeValidEvent({ schema_version: -1 })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_SCHEMA_VERSION)
    })

    it('rejects non-integer schema_version', () => {
      const payload = JSON.stringify([makeValidEvent({ schema_version: 1.5 })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_SCHEMA_VERSION)
    })
  })

  describe('missing fields', () => {
    it('rejects event missing id', () => {
      const event = makeValidEvent()
      delete event.id
      const result = validateBeaconPayload(JSON.stringify([event]))
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.MISSING_FIELD)
    })

    it('rejects event missing timestamp', () => {
      const event = makeValidEvent()
      delete event.timestamp
      const result = validateBeaconPayload(JSON.stringify([event]))
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.MISSING_FIELD)
    })

    it('rejects event missing type', () => {
      const event = makeValidEvent()
      delete event.type
      const result = validateBeaconPayload(JSON.stringify([event]))
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.MISSING_FIELD)
    })
  })

  describe('invalid field types', () => {
    it('rejects non-number timestamp', () => {
      const payload = JSON.stringify([makeValidEvent({ timestamp: 'not-a-number' })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_FIELD_TYPE)
    })

    it('rejects negative timestamp', () => {
      const payload = JSON.stringify([makeValidEvent({ timestamp: -1 })])
      const result = validateBeaconPayload(payload)
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe(BeaconValidationErrorCode.INVALID_FIELD_TYPE)
    })
  })
})
