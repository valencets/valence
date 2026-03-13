import { describe, it, expect, vi, afterEach } from 'vitest'
import { ok, err } from '@inertia/neverthrow'
import type { DbError } from '@inertia/db'

vi.mock('@inertia/db', () => ({
  aggregateSessionSummary: vi.fn(async () => ok(undefined)),
  aggregateEventSummary: vi.fn(async () => ok(undefined)),
  aggregateConversionSummary: vi.fn(async () => ok(undefined)),
  generateDailySummary: vi.fn(async () => ok(undefined))
}))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('startAggregationCron', () => {
  it('calls generateDailySummary with siteId and businessType', async () => {
    const { startAggregationCron } = await import('../server/aggregation-cron.js')
    const { generateDailySummary } = await import('@inertia/db')

    const pool = {} as never

    const handle = startAggregationCron(pool, 'studio', 'studio')

    // Give the boot run time to execute
    await new Promise((resolve) => { setTimeout(resolve, 50) })

    expect(generateDailySummary).toHaveBeenCalledWith(
      pool,
      'studio',
      'studio',
      expect.any(Date)
    )

    handle.stop()
  })

  it('calls all three intermediate aggregations before daily summary', async () => {
    const { startAggregationCron } = await import('../server/aggregation-cron.js')
    const {
      aggregateSessionSummary,
      aggregateEventSummary,
      aggregateConversionSummary
    } = await import('@inertia/db')

    const pool = {} as never
    const handle = startAggregationCron(pool, 'test-site', 'barbershop')

    await new Promise((resolve) => { setTimeout(resolve, 50) })

    expect(aggregateSessionSummary).toHaveBeenCalled()
    expect(aggregateEventSummary).toHaveBeenCalled()
    expect(aggregateConversionSummary).toHaveBeenCalled()

    handle.stop()
  })

  it('logs errors when aggregation fails', async () => {
    const { aggregateSessionSummary } = await import('@inertia/db')
    const sessionMock = aggregateSessionSummary as ReturnType<typeof vi.fn>
    const dbError: DbError = { code: 'QUERY_FAILED', message: 'table does not exist' }
    sessionMock.mockImplementation(async () => err(dbError))

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const { startAggregationCron } = await import('../server/aggregation-cron.js')
    const pool = {} as never
    const handle = startAggregationCron(pool, 'studio', 'other')

    await new Promise((resolve) => { setTimeout(resolve, 50) })

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[aggregation]'),
      expect.anything()
    )

    errorSpy.mockRestore()
    handle.stop()
  })
})
