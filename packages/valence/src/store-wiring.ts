import type { IncomingMessage, ServerResponse } from 'node:http'
import type { StoreInput } from '@valencets/store'
import { store as createStore } from '@valencets/store'
import { SessionStateHolder, SSEBroadcaster, registerStoreRoutes, renderStoreFragment, renderStoreHydration } from '@valencets/store/server'
import type { RouteHandler } from './define-config.js'
import { fromThrowable } from '@valencets/resultkit'

const safeJsonParse = fromThrowable(
  (text: string) => JSON.parse(text),
  () => null
)

function readJsonBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => { resolve(Buffer.concat(chunks).toString('utf-8')) })
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

function rejectNoSession (res: ServerResponse): void {
  const body = JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'No session — include session_id cookie or X-Session-Id header' } })
  res.writeHead(401, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
  res.end(body)
}

export function registerStoreRoutesOnServer (
  storeInputs: readonly StoreInput[],
  registerRoute: (method: string, path: string, handler: RouteHandler) => void
): void {
  const broadcaster = SSEBroadcaster.create()

  for (const input of storeInputs) {
    const storeResult = createStore(input)
    if (storeResult.isErr()) continue

    const config = storeResult.value
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder, broadcaster)

    // POST /store/:slug/:mutation — execute mutation
    registerRoute('POST', `/store/${config.slug}/:mutation`, async (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => {
      const sessionId = extractSessionId(req)
      if (sessionId === null) { rejectNoSession(res); return }
      const mutationName = params.mutation ?? ''
      const bodyText = await readJsonBody(req)
      const parseResult = safeJsonParse(bodyText)
      const parsed = (parseResult.isOk() && parseResult.value !== null) ? parseResult.value : {}
      // Client sends { args, mutationId } — echo mutationId back as confirmedId
      const args = parsed.args ?? parsed
      const clientMutationId = typeof parsed.mutationId === 'number' ? parsed.mutationId : undefined

      const result = await routes.handleMutation(sessionId, mutationName, args)

      if (result.isOk()) {
        if (config.fragment) {
          const fragmentResult = renderStoreFragment(config, result.value.state)
          if (fragmentResult.isOk()) {
            broadcaster.broadcastExcept(config.slug, sessionId, 'fragment', { ...fragmentResult.value })
          }
        }

        const confirmedId = clientMutationId ?? result.value.confirmedId
        const body = JSON.stringify({ ok: true, state: result.value.state, confirmedId })
        res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
        res.end(body)
      } else {
        const body = JSON.stringify({ error: result.error })
        const statusCode = result.error.code === 'VALIDATION_FAILED' ? 400 : 500
        res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
        res.end(body)
      }
    })

    // GET /store/:slug/state — current state for session
    registerRoute('GET', `/store/${config.slug}/state`, async (req: IncomingMessage, res: ServerResponse) => {
      const sessionId = extractSessionId(req)
      if (sessionId === null) { rejectNoSession(res); return }
      const state = routes.getState(sessionId)
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
      const state = routes.getState(sessionId)
      const html = renderStoreHydration(config.slug, state)
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': String(Buffer.byteLength(html)) })
      res.end(html)
    })
  }
}

export function maybeRegisterStores (
  stores: readonly StoreInput[] | undefined,
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  logFn?: (msg: string) => void
): void {
  if (!stores || stores.length === 0) return
  registerStoreRoutesOnServer(stores, registerRoute)
  if (logFn) logFn(`Registered ${stores.length} store(s)`)
}
