import { describe, it, expect, vi } from 'vitest'
import { aggregateSessionSummary, aggregateEventSummary, aggregateConversionSummary } from '../aggregation.js'
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

describe('aggregateSessionSummary', () => {
  it('is a function', () => {
    expect(typeof aggregateSessionSummary).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeMockPool([{
      id: 1,
      period_start: period.start,
      period_end: period.end,
      total_sessions: 10,
      unique_referrers: 3,
      device_mobile: 4,
      device_desktop: 5,
      device_tablet: 1,
      created_at: new Date()
    }])
    const result = aggregateSessionSummary(pool, period)
    expect(typeof result.andThen).toBe('function')
  })

  it('returns error on empty result', async () => {
    const pool = makeMockPool([])
    const result = await aggregateSessionSummary(pool, period)
    expect(result.isErr()).toBe(true)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await aggregateSessionSummary(pool, period)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('QUERY_FAILED')
  })
})

describe('aggregateEventSummary', () => {
  it('is a function', () => {
    expect(typeof aggregateEventSummary).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeMockPool([])
    const result = aggregateEventSummary(pool, period)
    expect(typeof result.andThen).toBe('function')
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await aggregateEventSummary(pool, period)
    expect(result.isErr()).toBe(true)
  })
})

describe('aggregateConversionSummary', () => {
  it('is a function', () => {
    expect(typeof aggregateConversionSummary).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeMockPool([])
    const result = aggregateConversionSummary(pool, period)
    expect(typeof result.andThen).toBe('function')
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await aggregateConversionSummary(pool, period)
    expect(result.isErr()).toBe(true)
  })
})
