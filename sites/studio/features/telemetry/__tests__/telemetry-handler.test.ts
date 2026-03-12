import { describe, it, expect, vi, beforeEach } from 'vitest'
import { okAsync, errAsync } from 'neverthrow'

beforeEach(() => {
  vi.resetModules()
})

describe('createPersistFn', () => {
  it('maps DbError to PERSIST_FAILURE error code', async () => {
    vi.doMock('@inertia/db', () => ({
      insertEvents: vi.fn(() => errAsync({ code: 'QUERY_FAILED', message: 'connection refused' }))
    }))
    vi.doMock('@inertia/ingestion', () => ({
      transformIntentsToEvents: vi.fn(() => [])
    }))

    const { createPersistFn } = await import('../server/telemetry-handler.js')
    const pool = {} as import('@inertia/db').DbPool
    const persist = createPersistFn(pool, 'test-session')
    const result = await persist({ intents: [], schema_version: 1 } as import('@inertia/ingestion').ValidatedTelemetryPayload)

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('PERSIST_FAILURE')
    expect(result._unsafeUnwrapErr().message).toBe('connection refused')
  })

  it('returns Ok with count on successful insert', async () => {
    vi.doMock('@inertia/db', () => ({
      insertEvents: vi.fn(() => okAsync(3))
    }))
    vi.doMock('@inertia/ingestion', () => ({
      transformIntentsToEvents: vi.fn(() => [])
    }))

    const { createPersistFn } = await import('../server/telemetry-handler.js')
    const pool = {} as import('@inertia/db').DbPool
    const persist = createPersistFn(pool, 'test-session')
    const result = await persist({ intents: [], schema_version: 1 } as import('@inertia/ingestion').ValidatedTelemetryPayload)

    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(3)
  })
})
