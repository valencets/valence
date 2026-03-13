import { ResultAsync, ok } from '@inertia/neverthrow'
import type { DbError } from '../types.js'
import type { DbPool } from '../connection.js'
import { mapPostgresError } from '../connection.js'

function todayPeriod (): { start: Date; end: Date } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

export function seedDemoSummaries (pool: DbPool): ResultAsync<true, DbError> {
  const { start, end } = todayPeriod()

  return ResultAsync.fromPromise(
    (async () => {
      // Session summary — realistic local business traffic
      await pool.sql`
        INSERT INTO session_summaries (period_start, period_end, total_sessions, unique_referrers, device_mobile, device_desktop, device_tablet)
        VALUES (${start}, ${end}, 247, 8, 156, 72, 19)
        ON CONFLICT DO NOTHING
      `

      // Event summaries — lead actions
      const eventCategories = [
        { category: 'INTENT_LEAD', count: 45, sessions: 38 },
        { category: 'INTENT_CALL', count: 28, sessions: 26 },
        { category: 'INTENT_BOOK', count: 12, sessions: 11 },
        { category: 'CLICK', count: 892, sessions: 210 },
        { category: 'SCROLL', count: 1540, sessions: 235 },
        { category: 'VIEWPORT_INTERSECT', count: 3100, sessions: 240 }
      ]

      for (const ev of eventCategories) {
        await pool.sql`
          INSERT INTO event_summaries (period_start, period_end, event_category, total_count, unique_sessions)
          VALUES (${start}, ${end}, ${ev.category}, ${ev.count}, ${ev.sessions})
          ON CONFLICT DO NOTHING
        `
      }

      // Conversion summaries
      const conversions = [
        { intent: 'INTENT_LEAD', count: 45, sources: JSON.stringify([{ referrer: 'google', count: 22 }, { referrer: 'direct', count: 15 }, { referrer: 'yelp', count: 8 }]) },
        { intent: 'INTENT_CALL', count: 28, sources: JSON.stringify([{ referrer: 'google', count: 18 }, { referrer: 'direct', count: 10 }]) }
      ]

      for (const conv of conversions) {
        await pool.sql`
          INSERT INTO conversion_summaries (period_start, period_end, intent_type, total_count, top_sources)
          VALUES (${start}, ${end}, ${conv.intent}, ${conv.count}, ${conv.sources}::jsonb)
          ON CONFLICT DO NOTHING
        `
      }

      // Ingestion health
      await pool.sql`
        INSERT INTO ingestion_health (period_start, payloads_accepted, payloads_rejected, avg_processing_ms, buffer_saturation_pct)
        VALUES (${start}, 5847, 23, 2.8, 14)
        ON CONFLICT DO NOTHING
      `

      // Daily summaries — 3 fictional fleet sites, 30 days each
      const fleetSites = [
        { siteId: 'site_acme_barbershop', businessType: 'barbershop', baseSessionCount: 180, baseConversionCount: 32 },
        { siteId: 'site_peak_legal', businessType: 'legal', baseSessionCount: 95, baseConversionCount: 18 },
        { siteId: 'site_downtown_dental', businessType: 'dental', baseSessionCount: 140, baseConversionCount: 25 }
      ]

      const today = new Date()
      for (const site of fleetSites) {
        for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
          const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - dayOffset)
          // Deterministic variance per day — avoids Math.random for reproducibility
          const variance = ((dayOffset * 7 + site.baseSessionCount) % 13) - 6
          const sessionCount = site.baseSessionCount + variance
          const pageviewCount = sessionCount * 3 + variance * 2
          const conversionCount = site.baseConversionCount + ((dayOffset * 3) % 7) - 3
          const rejectionCount = (dayOffset % 5 === 0) ? 2 : 0

          const topReferrers = JSON.stringify([
            { referrer: 'google', count: Math.max(1, sessionCount - 60) },
            { referrer: 'direct', count: Math.max(1, Math.floor(sessionCount * 0.2)) },
            { referrer: 'yelp', count: Math.max(1, Math.floor(sessionCount * 0.08)) }
          ])
          const topPages = JSON.stringify([
            { page: '/', count: sessionCount },
            { page: '/services', count: Math.floor(sessionCount * 0.6) },
            { page: '/contact', count: Math.floor(sessionCount * 0.3) }
          ])
          const intentCounts = JSON.stringify({
            INTENT_LEAD: Math.max(0, conversionCount - 5),
            INTENT_CALL: Math.max(0, conversionCount - 10),
            INTENT_BOOK: Math.max(0, Math.floor(conversionCount * 0.3))
          })

          const syncedAt = dayOffset === 0 ? null : date

          await pool.sql`
            INSERT INTO daily_summaries (site_id, date, business_type, schema_version, session_count, pageview_count, conversion_count, top_referrers, top_pages, intent_counts, avg_flush_ms, rejection_count, synced_at)
            VALUES (${site.siteId}, ${date}, ${site.businessType}, 1, ${sessionCount}, ${pageviewCount}, ${conversionCount}, ${topReferrers}::jsonb, ${topPages}::jsonb, ${intentCounts}::jsonb, 2.4, ${rejectionCount}, ${syncedAt})
            ON CONFLICT (site_id, date) DO NOTHING
          `
        }
      }

      return ok(true as const)
    })(),
    mapPostgresError
  ).andThen((r) => r)
}
