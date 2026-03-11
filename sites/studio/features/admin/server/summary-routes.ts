import { getSessionSummaries, getEventSummaries, getConversionSummaries, getIngestionHealth } from '@inertia/db'
import type { RouteHandler } from '../../../server/types.js'
import { sendJson } from '../../../server/router.js'

export const sessionSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getSessionSummaries(ctx.pool, 'TODAY')
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const eventSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getEventSummaries(ctx.pool, 'TODAY')
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const conversionSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getConversionSummaries(ctx.pool, 'TODAY')
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const ingestionHealthHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getIngestionHealth(ctx.pool)
  if (result.isOk()) {
    sendJson(res, result.value)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}
