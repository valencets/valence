import { describe, it, expect } from 'vitest'
import { aggregateSessionSummary, aggregateEventSummary, aggregateConversionSummary } from '../aggregation.js'
import { DbErrorCode } from '@valencets/db'
import type { SummaryPeriod } from '../summary-types.js'
import { makeMockPool, makeErrorPool } from './test-helpers.js'

const period: SummaryPeriod = {
  start: new Date('2026-03-01T00:00:00Z'),
  end: new Date('2026-03-02T00:00:00Z')
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

  it('returns error on empty result with NO_ROWS code', async () => {
    const pool = makeMockPool([])
    const result = await aggregateSessionSummary(pool, period)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(DbErrorCode.NO_ROWS)
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
