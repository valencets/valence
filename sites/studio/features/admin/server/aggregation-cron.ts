import { aggregateSessionSummary, aggregateEventSummary, aggregateConversionSummary, generateDailySummary } from '@inertia/db'
import type { DbPool, SummaryPeriod } from '@inertia/db'

const ONE_HOUR_MS = 3_600_000

function todayPeriod (): SummaryPeriod {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

export function startAggregationCron (pool: DbPool, siteId: string, businessType: string): { stop: () => void } {
  const run = async (): Promise<void> => {
    const period = todayPeriod()

    const sessionResult = await aggregateSessionSummary(pool, period)
    if (sessionResult.isErr()) {
      console.error('[aggregation] session summary failed:', sessionResult.error)
    }

    const eventResult = await aggregateEventSummary(pool, period)
    if (eventResult.isErr()) {
      console.error('[aggregation] event summary failed:', eventResult.error)
    }

    const conversionResult = await aggregateConversionSummary(pool, period)
    if (conversionResult.isErr()) {
      console.error('[aggregation] conversion summary failed:', conversionResult.error)
    }

    const dailyResult = await generateDailySummary(pool, siteId, businessType, new Date())
    if (dailyResult.isErr()) {
      console.error('[aggregation] daily summary failed:', dailyResult.error)
    }
  }

  run().then(
    () => { console.log('[aggregation] boot run complete') },
    (error) => { console.error('[aggregation] boot run crashed:', error) }
  )

  const intervalId = setInterval(() => {
    run().then(
      () => {},
      (error) => { console.error('[aggregation] hourly run crashed:', error) }
    )
  }, ONE_HOUR_MS)

  return {
    stop: () => { clearInterval(intervalId) }
  }
}
