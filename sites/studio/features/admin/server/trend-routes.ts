import { getDailyTrend } from '@inertia/db'
import type { RouteHandler } from '../../../server/types.js'
import { sendJson } from '../../../server/router.js'
import { parsePeriodRange } from './period-utils.js'

export const trendHandler: RouteHandler = async (req, res, ctx) => {
  const { start, end } = parsePeriodRange(req)
  const result = await getDailyTrend(ctx.pool, ctx.config.siteId, start, end)
  if (result.isOk()) {
    const days = result.value.map(row => ({
      date: row.date instanceof Date ? row.date.toISOString().split('T')[0] : String(row.date),
      session_count: row.session_count,
      pageview_count: row.pageview_count,
      conversion_count: row.conversion_count
    }))
    sendJson(res, { days })
    return
  }
  sendJson(res, { days: [] }, 500)
}
