import { describe, it, expect, vi, beforeEach } from 'vitest'
import { okAsync } from 'neverthrow'

beforeEach(() => {
  vi.resetModules()
})

describe('telemetryHandler session validation', () => {
  it('rejects telemetry with non-UUID session_id', async () => {
    const insertEventsFn = vi.fn(() => okAsync(0))
    vi.doMock('@inertia/db', () => ({
      insertEvents: insertEventsFn
    }))
    vi.doMock('@inertia/ingestion', () => ({
      createAsyncIngestionHandler: vi.fn(() => vi.fn()),
      transformIntentsToEvents: vi.fn(() => [])
    }))

    const { createPersistFn } = await import('../server/telemetry-handler.js')
    const pool = {} as import('@inertia/db').DbPool
    const persist = createPersistFn(pool, 'anonymous')
    const result = await persist({ intents: [], schema_version: 1 } as import('@inertia/ingestion').ValidatedTelemetryPayload)

    // Should reject non-UUID session_id before hitting DB
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('PERSIST_FAILURE')
    expect(insertEventsFn).not.toHaveBeenCalled()
  })

  it('accepts telemetry with valid UUID session_id', async () => {
    vi.doMock('@inertia/db', () => ({
      insertEvents: vi.fn(() => okAsync(3))
    }))
    vi.doMock('@inertia/ingestion', () => ({
      transformIntentsToEvents: vi.fn(() => [])
    }))

    const { createPersistFn } = await import('../server/telemetry-handler.js')
    const pool = {} as import('@inertia/db').DbPool
    const persist = createPersistFn(pool, 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    const result = await persist({ intents: [], schema_version: 1 } as import('@inertia/ingestion').ValidatedTelemetryPayload)

    expect(result.isOk()).toBe(true)
  })

  it('isValidUuid matches standard UUID v4 format', async () => {
    const { isValidUuid } = await import('../server/telemetry-handler.js')

    expect(isValidUuid('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')).toBe(true)
    expect(isValidUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
    expect(isValidUuid('anonymous')).toBe(false)
    expect(isValidUuid('')).toBe(false)
    expect(isValidUuid('not-a-uuid')).toBe(false)
  })
})
