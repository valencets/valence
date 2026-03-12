import { describe, it, expect } from 'vitest'
import { validateTelemetryPayload } from '../schemas.js'

function makeIntent (overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'evt-001',
    timestamp: 1710000000000,
    type: 'CLICK',
    targetDOMNode: '#cta-button',
    x_coord: 120,
    y_coord: 300,
    schema_version: 1,
    ...overrides
  }
}

describe('validateTelemetryPayload', () => {
  describe('Ok — valid payloads', () => {
    it('validates a single intent', () => {
      const result = validateTelemetryPayload([makeIntent()])
      expect(result.isOk()).toBe(true)
      const payload = result._unsafeUnwrap()
      expect(payload).toHaveLength(1)
      expect(payload[0]?.type).toBe('CLICK')
    })

    it('validates multiple intents', () => {
      const data = [
        makeIntent({ id: 'a' }),
        makeIntent({ id: 'b', type: 'SCROLL' })
      ]
      const result = validateTelemetryPayload(data)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toHaveLength(2)
    })

    it('validates all 7 IntentType values', () => {
      const types = [
        'CLICK', 'SCROLL', 'VIEWPORT_INTERSECT', 'FORM_INPUT',
        'INTENT_NAVIGATE', 'INTENT_CALL', 'INTENT_BOOK'
      ]
      for (const type of types) {
        const result = validateTelemetryPayload([makeIntent({ type })])
        expect(result.isOk()).toBe(true)
      }
    })

    it('validates an empty array', () => {
      const result = validateTelemetryPayload([])
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toHaveLength(0)
    })

    it('accepts zero values for coordinates', () => {
      const result = validateTelemetryPayload([makeIntent({ x_coord: 0, y_coord: 0 })])
      expect(result.isOk()).toBe(true)
    })

    it('accepts empty strings for string fields', () => {
      const result = validateTelemetryPayload([makeIntent({ id: '', targetDOMNode: '' })])
      expect(result.isOk()).toBe(true)
    })

    it('accepts path and referrer fields', () => {
      const result = validateTelemetryPayload([makeIntent({ path: '/about', referrer: 'https://google.com' })])
      expect(result.isOk()).toBe(true)
      const intent = result._unsafeUnwrap()[0]
      expect(intent?.path).toBe('/about')
      expect(intent?.referrer).toBe('https://google.com')
    })

    it('accepts intents without path and referrer (backward compat)', () => {
      const result = validateTelemetryPayload([makeIntent()])
      expect(result.isOk()).toBe(true)
      const intent = result._unsafeUnwrap()[0]
      expect(intent).not.toHaveProperty('path')
    })

    it('validates schema_version field as literal 1', () => {
      const result = validateTelemetryPayload([makeIntent()])
      expect(result.isOk()).toBe(true)
      const intent = result._unsafeUnwrap()[0]
      expect(intent?.schema_version).toBe(1)
    })
  })

  describe('strips — unrecognized fields removed', () => {
    it('strips isDirty from output', () => {
      const result = validateTelemetryPayload([makeIntent({ isDirty: true })])
      expect(result.isOk()).toBe(true)
      const intent = result._unsafeUnwrap()[0]
      expect(intent).not.toHaveProperty('isDirty')
    })

    it('strips unknown extra fields', () => {
      const result = validateTelemetryPayload([makeIntent({ foo: 'bar', extra: 99 })])
      expect(result.isOk()).toBe(true)
      const intent = result._unsafeUnwrap()[0]
      expect(intent).not.toHaveProperty('foo')
      expect(intent).not.toHaveProperty('extra')
    })
  })

  describe('Err — invalid payloads', () => {
    it('rejects a non-array object', () => {
      const result = validateTelemetryPayload({ id: 'a' })
      expect(result.isErr()).toBe(true)
    })

    it('rejects a string', () => {
      const result = validateTelemetryPayload('not an array')
      expect(result.isErr()).toBe(true)
    })

    it('rejects null', () => {
      const result = validateTelemetryPayload(null)
      expect(result.isErr()).toBe(true)
    })

    it('rejects intent missing id', () => {
      const { id: _, ...noId } = makeIntent()
      const result = validateTelemetryPayload([noId])
      expect(result.isErr()).toBe(true)
    })

    it('rejects intent missing type', () => {
      const { type: _, ...noType } = makeIntent()
      const result = validateTelemetryPayload([noType])
      expect(result.isErr()).toBe(true)
    })

    it('rejects invalid type value', () => {
      const result = validateTelemetryPayload([makeIntent({ type: 'INVALID_TYPE' })])
      expect(result.isErr()).toBe(true)
    })

    it('rejects wrong field types (string for number)', () => {
      const result = validateTelemetryPayload([makeIntent({ x_coord: 'not a number' })])
      expect(result.isErr()).toBe(true)
    })

    it('rejects wrong field types (number for string)', () => {
      const result = validateTelemetryPayload([makeIntent({ id: 123 })])
      expect(result.isErr()).toBe(true)
    })

    it('rejects missing schema_version', () => {
      const { schema_version: _, ...noVersion } = makeIntent()
      const result = validateTelemetryPayload([noVersion])
      expect(result.isErr()).toBe(true)
    })

    it('rejects wrong schema_version value', () => {
      const result = validateTelemetryPayload([makeIntent({ schema_version: 2 })])
      expect(result.isErr()).toBe(true)
    })
  })

  describe('contract — error shape', () => {
    it('error has code VALIDATION_FAILURE', () => {
      const result = validateTelemetryPayload('bad')
      expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_FAILURE')
    })

    it('error has non-empty issues array', () => {
      const result = validateTelemetryPayload('bad')
      const failure = result._unsafeUnwrapErr()
      expect(failure.issues.length).toBeGreaterThan(0)
    })

    it('each issue has path and message', () => {
      const result = validateTelemetryPayload([makeIntent({ type: 'BAD' })])
      const failure = result._unsafeUnwrapErr()
      const issue = failure.issues[0]
      expect(issue).toHaveProperty('path')
      expect(issue).toHaveProperty('message')
      expect(typeof issue?.path).toBe('string')
      expect(typeof issue?.message).toBe('string')
    })
  })

  describe('edge cases', () => {
    it('handles a large array (1024 intents)', () => {
      const items = Array.from({ length: 1024 }, (_, i) =>
        makeIntent({ id: `evt-${i}` })
      )
      const result = validateTelemetryPayload(items)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toHaveLength(1024)
    })

    it('rejects NaN for numeric fields', () => {
      const result = validateTelemetryPayload([makeIntent({ x_coord: NaN })])
      expect(result.isErr()).toBe(true)
    })

    it('rejects Infinity for numeric fields', () => {
      const result = validateTelemetryPayload([makeIntent({ y_coord: Infinity })])
      expect(result.isErr()).toBe(true)
    })
  })
})
