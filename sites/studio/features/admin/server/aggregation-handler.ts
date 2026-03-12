import { verifySignature, validateDailySummary, safeJsonParse } from '@inertia/ingestion'
import { insertDailySummaryFromRemote } from '@inertia/db'
import type { RouteHandler } from '../../../server/types.js'
import { readBody, sendJson } from '../../../server/router.js'

const BLACK_HOLE_RESPONSE = { ok: true }

export const aggregationHandler: RouteHandler = async (req, res, ctx) => {
  const body = await readBody(req)
  const signature = req.headers['x-inertia-signature'] as string | undefined
  const secret = ctx.config.siteSecret ?? ''

  // Black Hole: always return 200 OK
  if (!signature || signature.length === 0) {
    sendJson(res, BLACK_HOLE_RESPONSE, 200)
    return
  }

  const verifyResult = verifySignature(secret, body, signature)
  if (verifyResult.isErr()) {
    sendJson(res, BLACK_HOLE_RESPONSE, 200)
    return
  }

  const parseResult = safeJsonParse(body)
  if (parseResult.isErr()) {
    sendJson(res, BLACK_HOLE_RESPONSE, 200)
    return
  }

  const validateResult = validateDailySummary(parseResult.value)
  if (validateResult.isErr()) {
    sendJson(res, BLACK_HOLE_RESPONSE, 200)
    return
  }

  await insertDailySummaryFromRemote(ctx.pool, validateResult.value)

  sendJson(res, BLACK_HOLE_RESPONSE, 200)
}
