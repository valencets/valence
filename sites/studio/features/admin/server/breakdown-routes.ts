import { getDailyBreakdowns } from '@inertia/db'
import { aggregateByCategory } from '@inertia/hud/dist/data/classify-referrer.js'
import type { RouteHandler } from '../../../server/types.js'
import { sendJson } from '../../../server/router.js'
import { parsePeriodRange } from './period-utils.js'

const LEAD_PREFIX = 'LEAD_'

const EMPTY_PAGES = { pages: [] as readonly { path: string; count: number }[] }
const EMPTY_SOURCES = { sources: [] as readonly { category: string; count: number; percent: number }[] }
const EMPTY_ACTIONS = { actions: [] as readonly { action: string; count: number }[] }

export const breakdownPagesHandler: RouteHandler = async (req, res, ctx) => {
  const { start, end } = parsePeriodRange(req)
  const result = await getDailyBreakdowns(ctx.pool, ctx.config.siteId, start, end)
  if (result.isOk()) {
    sendJson(res, { pages: result.value.top_pages })
    return
  }
  sendJson(res, EMPTY_PAGES, 500)
}

export const breakdownSourcesHandler: RouteHandler = async (req, res, ctx) => {
  const { start, end } = parsePeriodRange(req)
  const result = await getDailyBreakdowns(ctx.pool, ctx.config.siteId, start, end)
  if (result.isOk()) {
    const sources = aggregateByCategory(result.value.top_referrers)
    sendJson(res, { sources })
    return
  }
  sendJson(res, EMPTY_SOURCES, 500)
}

export const breakdownActionsHandler: RouteHandler = async (req, res, ctx) => {
  const { start, end } = parsePeriodRange(req)
  const result = await getDailyBreakdowns(ctx.pool, ctx.config.siteId, start, end)
  if (result.isOk()) {
    const intentCounts = result.value.intent_counts
    const actions = Object.entries(intentCounts)
      .filter(([key]) => key.startsWith(LEAD_PREFIX))
      .map(([action, count]) => ({ action, count }))
      .sort((a, b) => b.count - a.count)
    sendJson(res, { actions })
    return
  }
  sendJson(res, EMPTY_ACTIONS, 500)
}
