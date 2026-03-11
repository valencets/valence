import { aggregateSessionSummary, aggregateEventSummary, aggregateConversionSummary } from '@inertia/db'
import type { DbPool } from '@inertia/db'

const ONE_HOUR_MS = 3_600_000

export function startAggregationCron (pool: DbPool): { stop: () => void } {
  const run = async (): Promise<void> => {
    await aggregateSessionSummary(pool, 'TODAY')
    await aggregateEventSummary(pool, 'TODAY')
    await aggregateConversionSummary(pool, 'TODAY')
  }

  // Run once on boot
  run().then(() => {}, () => {})

  const intervalId = setInterval(() => { run().then(() => {}, () => {}) }, ONE_HOUR_MS)

  return {
    stop: () => { clearInterval(intervalId) }
  }
}
