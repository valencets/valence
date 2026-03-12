import { describe, it, expect, vi } from 'vitest'
import { getSessionSummaries, getEventSummaries, getConversionSummaries, getIngestionHealth, insertIngestionHealth } from '../summary-queries.js'
import { DbErrorCode } from '../types.js'
import type { DbPool } from '../connection.js'
import type { SummaryPeriod } from '../summary-types.js'

const period: SummaryPeriod = {
  start: new Date('2026-03-01T00:00:00Z'),
  end: new Date('2026-03-02T00:00:00Z')
}

function makeMockPool (returnValue: unknown = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

function makeErrorPool (error: Error): DbPool {
  const sql = vi.fn(() => Promise.reject(error)) as unknown as DbPool['sql']
  return { sql }
}

describe('getSessionSummaries', () => {
  it('is a function', () => {
    expect(typeof getSessionSummaries).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeMockPool()
    const result = getSessionSummaries(pool, period)
    expect(typeof result.andThen).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getSessionSummaries(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getSessionSummaries(pool, period)
    expect(result.isErr()).toBe(true)
  })
})

describe('getEventSummaries', () => {
  it('is a function', () => {
    expect(typeof getEventSummaries).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getEventSummaries(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })
})

describe('getConversionSummaries', () => {
  it('is a function', () => {
    expect(typeof getConversionSummaries).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getConversionSummaries(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })
})

describe('getIngestionHealth', () => {
  it('is a function', () => {
    expect(typeof getIngestionHealth).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getIngestionHealth(pool, period)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })
})

describe('insertIngestionHealth', () => {
  it('is a function', () => {
    expect(typeof insertIngestionHealth).toBe('function')
  })

  it('returns error on empty result with NO_ROWS code', async () => {
    const pool = makeMockPool([])
    const result = await insertIngestionHealth(pool, {
      period_start: new Date(),
      payloads_accepted: 100,
      payloads_rejected: 5,
      avg_processing_ms: 12.5,
      buffer_saturation_pct: 0.3
    })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(DbErrorCode.NO_ROWS)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await insertIngestionHealth(pool, {
      period_start: new Date(),
      payloads_accepted: 100,
      payloads_rejected: 5,
      avg_processing_ms: 12.5,
      buffer_saturation_pct: 0.3
    })
    expect(result.isErr()).toBe(true)
  })
})
