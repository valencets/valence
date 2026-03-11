import { aggregateSessionSummary, aggregateEventSummary, aggregateConversionSummary } from '@inertia/db'
import type { DbPool, SummaryPeriod } from '@inertia/db'

const ONE_HOUR_MS = 3_600_000

function todayPeriod (): SummaryPeriod {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

export function startAggregationCron (pool: DbPool): { stop: () => void } {
  const run = async (): Promise<void> => {
    const period = todayPeriod()
    await aggregateSessionSummary(pool, period)
    await aggregateEventSummary(pool, period)
    await aggregateConversionSummary(pool, period)
  }

  // Run once on boot
  run().then(() => {}, () => {})

  const intervalId = setInterval(() => { run().then(() => {}, () => {}) }, ONE_HOUR_MS)

  return {
    stop: () => { clearInterval(intervalId) }
  }
}
