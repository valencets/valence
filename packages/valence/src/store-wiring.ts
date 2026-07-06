import type { IncomingMessage, ServerResponse } from 'node:http'
import type { StoreInput } from '@valencets/store'
import { store as createStore } from '@valencets/store'
import { SessionStateHolder, SSEBroadcaster, registerStoreRoutes, renderStoreFragment, renderStoreHydration } from '@valencets/store/server'
import type { StorePool } from '@valencets/store/server'
import type { DbPool } from '@valencets/db'
import type { RouteHandler } from './define-config.js'
import { fromThrowable, ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'

const MAX_BODY_BYTES = 256 * 1024

const safeJsonParse = fromThrowable(
  (text: string) => JSON.parse(text),
  () => null
)

type BodyError = 'TOO_LARGE' | 'STREAM_ERROR'

function readJsonBody (req: IncomingMessage): Promise<Result<string, BodyError>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    let total = 0
    let settled = false
    const settle = (result: Result<string, BodyError>): void => {
      if (settled) return
      settled = true
      resolve(result)
    }
    req.on('data', (chunk: Buffer) => {
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        settle(err('TOO_LARGE'))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => { settle(ok(Buffer.concat(chunks).toString('utf-8'))) })
    req.on('error', () => { settle(err('STREAM_ERROR')) })
  })
}

function extractSessionId (req: IncomingMessage): string | null {
  const cookie = req.headers.cookie ?? ''
  // Check session_id cookie (store sessions) and cms_session cookie (CMS auth)
  const storeMatch = cookie.match(/(?:^|;\s*)session_id=([^;]+)/)
  if (storeMatch && storeMatch[1]) return storeMatch[1]
  const cmsMatch = cookie.match(/(?:^|;\s*)cms_session=([^;]+)/)
  if (cmsMatch && cmsMatch[1]) return cmsMatch[1]
  // Fallback: explicit header for API clients
  const header = req.headers['x-session-id']
  if (typeof header === 'string' && header.length > 0) return header
  return null
}

function sendJson (res: ServerResponse, statusCode: number, payload: { readonly [key: string]: unknown }): void {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
  res.end(body)
}

function rejectNoSession (res: ServerResponse): void {
  sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'No session — include session_id cookie or X-Session-Id header' } })
}

const ERROR_STATUS: Readonly<Record<string, number>> = Object.freeze({
  VALIDATION_FAILED: 400,
  INVALID_MUTATION: 404,
  STORE_NOT_FOUND: 404
})

export interface StoreWiringOptions {
  readonly pool?: StorePool
  readonly log?: (msg: string) => void
}

export function registerStoreRoutesOnServer (
  storeInputs: readonly StoreInput[],
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  options?: StoreWiringOptions
): void {
  const broadcaster = SSEBroadcaster.create()
  const log = options?.log ?? (() => {})

  for (const input of storeInputs) {
    const storeResult = createStore(input)
    if (storeResult.isErr()) {
      log(`Store '${input.slug}' has an invalid definition and was skipped: ${storeResult.error.message}`)
      continue
    }

    const config = storeResult.value

    // Page-scoped stores are client-only typed signals — no server state,
    // no mutation endpoints, no SSE.
    if (config.scope === 'page') {
      log(`Store '${config.slug}' is page-scoped — no server routes registered`)
      continue
    }

    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder, broadcaster, options?.pool)

    // POST /store/:slug/:mutation — execute mutation
    registerRoute('POST', `/store/${config.slug}/:mutation`, async (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => {
      const sessionId = extractSessionId(req)
      if (sessionId === null) { rejectNoSession(res); return }
      const mutationName = params.mutation ?? ''
      const bodyResult = await readJsonBody(req)
      if (bodyResult.isErr()) {
        const statusCode = bodyResult.error === 'TOO_LARGE' ? 413 : 400
        sendJson(res, statusCode, { error: { code: 'BAD_REQUEST', message: 'Request body rejected' } })
        return
      }
      const parseResult = safeJsonParse(bodyResult.value)
      const parsed = (parseResult.isOk() && parseResult.value !== null) ? parseResult.value : {}
      // Client sends { args, mutationId } — the handler chain echoes the id
      // back as confirmedId so the client can settle its pending queue.
      const args = parsed.args ?? parsed
      const clientMutationId = typeof parsed.mutationId === 'number' ? parsed.mutationId : undefined

      const result = await routes.handleMutation({ id: sessionId }, mutationName, args, clientMutationId)

      if (result.isOk()) {
        let fragmentPayload: { selector: string; html: string } | null = null
        if (config.fragment) {
          const fragmentResult = renderStoreFragment(config, result.value.state)
          if (fragmentResult.isOk()) {
            fragmentPayload = { ...fragmentResult.value }
            // Scope decides the SSE audience, mirroring the state event:
            // global fans out, session/user reach only the session's tabs.
            if (config.scope === 'global') {
              broadcaster.broadcast(config.slug, 'fragment', fragmentPayload)
            } else {
              broadcaster.sendToSession(config.slug, sessionId, 'fragment', fragmentPayload)
            }
          }
        }

        sendJson(res, 200, {
          ok: true,
          state: result.value.state,
          confirmedId: result.value.confirmedId,
          ...(fragmentPayload !== null ? { fragment: fragmentPayload } : {})
        })
      } else {
        const statusCode = ERROR_STATUS[result.error.code] ?? 500
        sendJson(res, statusCode, { error: result.error })
      }
    })

    // GET /store/:slug/state — current state for session
    registerRoute('GET', `/store/${config.slug}/state`, async (req: IncomingMessage, res: ServerResponse) => {
      const sessionId = extractSessionId(req)
      if (sessionId === null) { rejectNoSession(res); return }
      const state = await routes.getState({ id: sessionId })
      const body = JSON.stringify(state)
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
      res.end(body)
    })

    // GET /store/:slug/events — SSE endpoint
    registerRoute('GET', `/store/${config.slug}/events`, async (req: IncomingMessage, res: ServerResponse) => {
      const sessionId = extractSessionId(req)
      if (sessionId === null) { rejectNoSession(res); return }
      broadcaster.addClient(config.slug, sessionId, res)
    })

    // GET /store/:slug/hydration — hydration script tag
    registerRoute('GET', `/store/${config.slug}/hydration`, async (req: IncomingMessage, res: ServerResponse) => {
      const sessionId = extractSessionId(req)
      if (sessionId === null) { rejectNoSession(res); return }
      const state = await routes.getState({ id: sessionId })
      const html = renderStoreHydration(config.slug, state)
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': String(Buffer.byteLength(html)) })
      res.end(html)
    })
  }
}

export function maybeRegisterStores (
  stores: readonly StoreInput[] | undefined,
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  logFn?: (msg: string) => void,
  dbPool?: DbPool
): void {
  if (!stores || stores.length === 0) return
  const options: StoreWiringOptions = {
    ...(logFn ? { log: logFn } : {}),
    ...(dbPool
      ? {
          pool: {
            query: async (...args: readonly string[]) => {
              const [text, ...params] = args
              return await dbPool.sql.unsafe(text ?? '', [...params])
            }
          }
        }
      : {})
  }
  registerStoreRoutesOnServer(stores, registerRoute, options)
  if (logFn) logFn(`Registered ${stores.length} store(s)`)
}
