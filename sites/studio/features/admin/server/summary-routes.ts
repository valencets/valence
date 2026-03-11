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

const EMPTY_SESSION = {
  period_start: '',
  period_end: '',
  total_sessions: 0,
  unique_referrers: 0,
  device_mobile: 0,
  device_desktop: 0,
  device_tablet: 0
}

const EMPTY_EVENT = {
  period_start: '',
  period_end: '',
  event_category: '',
  total_count: 0,
  unique_sessions: 0
}

const EMPTY_CONVERSION = {
  period_start: '',
  period_end: '',
  intent_type: '',
  total_count: 0,
  top_sources: [] as readonly { readonly referrer: string; readonly count: number }[]
}

const EMPTY_INGESTION = {
  period_start: '',
  payloads_accepted: 0,
  payloads_rejected: 0,
  avg_processing_ms: 0,
  buffer_saturation_pct: 0
}

export const sessionSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getSessionSummaries(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value[0] ?? EMPTY_SESSION)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const eventSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getEventSummaries(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value[0] ?? EMPTY_EVENT)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const conversionSummaryHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getConversionSummaries(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value[0] ?? EMPTY_CONVERSION)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}

export const ingestionHealthHandler: RouteHandler = async (_req, res, ctx) => {
  const result = await getIngestionHealth(ctx.pool, todayPeriod())
  if (result.isOk()) {
    sendJson(res, result.value[0] ?? EMPTY_INGESTION)
    return
  }
  sendJson(res, { error: result.error.message }, 500)
}
