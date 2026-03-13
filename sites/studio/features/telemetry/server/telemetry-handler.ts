import type { ResultAsync } from 'neverthrow'
import { errAsync } from 'neverthrow'
import { createAsyncIngestionHandler } from '@inertia/ingestion'
import type { AuditEntry } from '@inertia/ingestion'
import { transformIntentsToEvents } from '@inertia/ingestion'
import { insertEvents } from '@inertia/db'
import type { DbPool } from '@inertia/db'
import type { RouteHandler } from '../../../server/types.js'
import { readBody, sendJson } from '../../../server/router.js'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUuid (value: string): boolean {
  return UUID_RE.test(value)
}

export function createPersistFn (pool: DbPool, sessionId: string) {
  return (payload: import('@inertia/ingestion').ValidatedTelemetryPayload): ResultAsync<number, { code: 'PERSIST_FAILURE'; message: string }> => {
    if (!isValidUuid(sessionId)) {
      return errAsync({ code: 'PERSIST_FAILURE' as const, message: 'Invalid session_id: not a UUID' })
    }
    const events = transformIntentsToEvents(payload, sessionId)
    return insertEvents(pool, events)
      .mapErr((dbErr) => ({ code: 'PERSIST_FAILURE' as const, message: dbErr.message }))
  }
}

const auditLog: AuditEntry[] = []

function audit (entry: AuditEntry): void {
  auditLog.push(entry)
  // Keep last 1000 entries
  if (auditLog.length > 1000) {
    auditLog.shift()
  }
}

export const telemetryHandler: RouteHandler = async (req, res, ctx) => {
  const cookies = req.headers.cookie ?? ''
  const sessionMatch = /session_id=([^;]+)/.exec(cookies)
  const sessionId = sessionMatch?.[1] ?? ''

  // Reject early if no valid session — avoids processing payload for nothing
  if (!isValidUuid(sessionId)) {
    sendJson(res, { status: 'dropped', reason: 'no_session' })
    return
  }

  const body = await readBody(req)
  const persist = createPersistFn(ctx.pool, sessionId)
  const handler = createAsyncIngestionHandler(persist, audit)
  const response = await handler(body)

  sendJson(res, JSON.parse(response.body), response.status)
}
