import { describe, it, expect, vi } from 'vitest'
import { ok, err } from 'neverthrow'
import { createIngestionPipeline } from '../pipeline.js'
import type { PersistFn } from '../pipeline.js'
import type { ValidatedTelemetryPayload } from '../schemas.js'

function makeValidPayloadJson (count: number = 1): string {
  const intents = Array.from({ length: count }, (_, i) => ({
    id: `evt-${i}`,
    timestamp: 1710000000000 + i,
    type: 'CLICK',
    targetDOMNode: `#btn-${i}`,
    x_coord: 100 + i,
    y_coord: 200 + i
  }))
  return JSON.stringify(intents)
}

const stubPersist: PersistFn = (payload: ValidatedTelemetryPayload) =>
  ok(payload.length)

const failPersist: PersistFn = () =>
  err({ code: 'PERSIST_FAILURE', message: 'Database connection refused' })

describe('createIngestionPipeline', () => {
  describe('success path', () => {
    it('returns Ok with persisted count for valid JSON', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const result = pipeline(makeValidPayloadJson(3))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(3)
    })

    it('handles a single intent', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const result = pipeline(makeValidPayloadJson(1))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(1)
    })

    it('handles an empty array', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const result = pipeline('[]')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(0)
    })

    it('handles a large payload', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const result = pipeline(makeValidPayloadJson(512))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(512)
    })
  })

  describe('parse failure propagation', () => {
    it('returns PARSE_FAILURE for malformed JSON', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const result = pipeline('{bad json')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('PARSE_FAILURE')
    })

    it('includes raw input in parse error', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const raw = 'definitely not json'
      const result = pipeline(raw)
      expect(result.isErr()).toBe(true)
      const failure = result._unsafeUnwrapErr()
      if (failure.code === 'PARSE_FAILURE') {
        expect(failure.raw).toBe(raw)
      }
    })
  })

  describe('validation failure propagation', () => {
    it('returns VALIDATION_FAILURE for valid JSON with wrong shape', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const result = pipeline('{"not":"an array"}')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_FAILURE')
    })

    it('returns VALIDATION_FAILURE for invalid intent fields', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const result = pipeline('[{"id":123}]')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_FAILURE')
    })
  })

  describe('persist failure propagation', () => {
    it('returns PERSIST_FAILURE when persist function fails', () => {
      const pipeline = createIngestionPipeline(failPersist)
      const result = pipeline(makeValidPayloadJson())
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('PERSIST_FAILURE')
    })

    it('includes persist error message', () => {
      const pipeline = createIngestionPipeline(failPersist)
      const result = pipeline(makeValidPayloadJson())
      expect(result._unsafeUnwrapErr().message).toBe('Database connection refused')
    })
  })

  describe('short-circuit behavior', () => {
    it('does not call persist on parse failure', () => {
      const spy = vi.fn(stubPersist)
      const pipeline = createIngestionPipeline(spy)
      pipeline('{bad')
      expect(spy).not.toHaveBeenCalled()
    })

    it('does not call persist on validation failure', () => {
      const spy = vi.fn(stubPersist)
      const pipeline = createIngestionPipeline(spy)
      pipeline('"just a string"')
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('composition', () => {
    it('factory injection works with different persist functions', () => {
      const countingPersist: PersistFn = () => ok(42)
      const pipeline = createIngestionPipeline(countingPersist)
      const result = pipeline(makeValidPayloadJson())
      expect(result._unsafeUnwrap().persisted).toBe(42)
    })

    it('pipeline is reusable across multiple calls', () => {
      const pipeline = createIngestionPipeline(stubPersist)
      const r1 = pipeline(makeValidPayloadJson(2))
      const r2 = pipeline(makeValidPayloadJson(5))
      expect(r1._unsafeUnwrap().persisted).toBe(2)
      expect(r2._unsafeUnwrap().persisted).toBe(5)
    })

    it('errors from different stages have distinct codes', () => {
      const pipeline = createIngestionPipeline(failPersist)
      const parseErr = pipeline('{bad')
      const validErr = pipeline('"string"')
      const persistErr = pipeline(makeValidPayloadJson())
      expect(parseErr._unsafeUnwrapErr().code).toBe('PARSE_FAILURE')
      expect(validErr._unsafeUnwrapErr().code).toBe('VALIDATION_FAILURE')
      expect(persistErr._unsafeUnwrapErr().code).toBe('PERSIST_FAILURE')
    })
  })
})
