import { describe, it, expect, vi } from 'vitest'
import { okAsync, errAsync } from 'neverthrow'
import { createAsyncIngestionPipeline } from '../pipeline.js'
import type { AsyncPersistFn } from '../pipeline.js'
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

const stubAsyncPersist: AsyncPersistFn = (payload: ValidatedTelemetryPayload) =>
  okAsync(payload.length)

const failAsyncPersist: AsyncPersistFn = () =>
  errAsync({ code: 'PERSIST_FAILURE', message: 'Database connection refused' })

describe('createAsyncIngestionPipeline', () => {
  describe('success path', () => {
    it('returns Ok with persisted count for valid JSON', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const result = await pipeline(makeValidPayloadJson(3))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(3)
    })

    it('handles a single intent', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const result = await pipeline(makeValidPayloadJson(1))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(1)
    })

    it('handles an empty array', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const result = await pipeline('[]')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(0)
    })

    it('handles a large payload', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const result = await pipeline(makeValidPayloadJson(512))
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap().persisted).toBe(512)
    })
  })

  describe('parse failure propagation', () => {
    it('returns PARSE_FAILURE for malformed JSON', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const result = await pipeline('{bad json')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('PARSE_FAILURE')
    })

    it('includes raw input in parse error', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const raw = 'definitely not json'
      const result = await pipeline(raw)
      expect(result.isErr()).toBe(true)
      const failure = result._unsafeUnwrapErr()
      if (failure.code === 'PARSE_FAILURE') {
        expect(failure.raw).toBe(raw)
      }
    })
  })

  describe('validation failure propagation', () => {
    it('returns VALIDATION_FAILURE for valid JSON with wrong shape', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const result = await pipeline('{"not":"an array"}')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('VALIDATION_FAILURE')
    })
  })

  describe('persist failure propagation', () => {
    it('returns PERSIST_FAILURE when async persist function fails', async () => {
      const pipeline = createAsyncIngestionPipeline(failAsyncPersist)
      const result = await pipeline(makeValidPayloadJson())
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('PERSIST_FAILURE')
    })

    it('includes persist error message', async () => {
      const pipeline = createAsyncIngestionPipeline(failAsyncPersist)
      const result = await pipeline(makeValidPayloadJson())
      expect(result._unsafeUnwrapErr().message).toBe('Database connection refused')
    })
  })

  describe('short-circuit behavior', () => {
    it('does not call persist on parse failure', async () => {
      const spy = vi.fn(stubAsyncPersist)
      const pipeline = createAsyncIngestionPipeline(spy)
      await pipeline('{bad')
      expect(spy).not.toHaveBeenCalled()
    })

    it('does not call persist on validation failure', async () => {
      const spy = vi.fn(stubAsyncPersist)
      const pipeline = createAsyncIngestionPipeline(spy)
      await pipeline('"just a string"')
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe('composition', () => {
    it('factory injection works with different async persist functions', async () => {
      const countingPersist: AsyncPersistFn = () => okAsync(42)
      const pipeline = createAsyncIngestionPipeline(countingPersist)
      const result = await pipeline(makeValidPayloadJson())
      expect(result._unsafeUnwrap().persisted).toBe(42)
    })

    it('pipeline is reusable across multiple calls', async () => {
      const pipeline = createAsyncIngestionPipeline(stubAsyncPersist)
      const r1 = await pipeline(makeValidPayloadJson(2))
      const r2 = await pipeline(makeValidPayloadJson(5))
      expect(r1._unsafeUnwrap().persisted).toBe(2)
      expect(r2._unsafeUnwrap().persisted).toBe(5)
    })

    it('errors from different stages have distinct codes', async () => {
      const pipeline = createAsyncIngestionPipeline(failAsyncPersist)
      const parseErr = await pipeline('{bad')
      const validErr = await pipeline('"string"')
      const persistErr = await pipeline(makeValidPayloadJson())
      expect(parseErr._unsafeUnwrapErr().code).toBe('PARSE_FAILURE')
      expect(validErr._unsafeUnwrapErr().code).toBe('VALIDATION_FAILURE')
      expect(persistErr._unsafeUnwrapErr().code).toBe('PERSIST_FAILURE')
    })
  })
})
