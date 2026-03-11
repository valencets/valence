import { getSessionSummaries, getEventSummaries, getConversionSummaries, getIngestionHealth } from '@inertia/db'
import type { RouteHandler } from '../../../server/types.js'
import type { SummaryPeriod } from '@inertia/db'
import { sendJson } from '../../../server/router.js'

function todayPeriod (): SummaryPeriod {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end = new Date(start.getTime() + 86_400_000)
  return { start, end }
}

export const sessionSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getSessionSummaries(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const eventSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getEventSummaries(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const conversionSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getConversionSummaries(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const ingestionHealthHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getIngestionHealth(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}
