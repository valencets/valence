import type { IncomingMessage, ServerResponse } from 'node:http'
import type { StoreInput, SessionInfo } from '@valencets/store'
import { store as createStore } from '@valencets/store'
import { SessionStateHolder, PostgresStateHolder, SSEBroadcaster, registerStoreRoutes, renderStoreFragment, renderStoreHydration } from '@valencets/store/server'
import type { StorePool, StateBackend } from '@valencets/store/server'
import type { DbPool } from '@valencets/db'
import { validateSession } from '@valencets/cms'
import type { RouteHandler } from './define-config.js'
import { mintSignedSessionId, verifySignedSessionId, buildStoreSessionCookie } from './store-session.js'
import { fromThrowable, ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'

const MAX_BODY_BYTES = 256 * 1024

export const STORE_STATES_DDL = `CREATE TABLE IF NOT EXISTS store_states (
  store_slug TEXT NOT NULL,
  state_key TEXT NOT NULL,
  state JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY (store_slug, state_key)
)`

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

function readCookie (req: IncomingMessage, name: string): string | null {
  const cookie = req.headers.cookie ?? ''
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`))
  return match && match[1] ? match[1] : null
}

function readSessionToken (req: IncomingMessage): string | null {
  const fromCookie = readCookie(req, 'session_id')
  if (fromCookie) return fromCookie
  const header = req.headers['x-session-id']
  if (typeof header === 'string' && header.length > 0) return header
  return null
}

/**
 * Resolve the caller's identity, strongest claim first:
 *
 * 1. A cms_session cookie validated against the CMS sessions table yields
 *    an authenticated identity with a userId.
 * 2. A session_id cookie / X-Session-Id header must carry a server-signed
 *    token — forged ids are rejected, not trusted.
 * 3. No claim at all mints a fresh signed anonymous session and sets the
 *    cookie, so first contact and every later request share one bucket.
 *
 * Without a secret configured, fall back to the legacy presence check
 * (dev-only; production start always has CMS_SECRET).
 */
async function resolveIdentity (
  req: IncomingMessage,
  res: ServerResponse,
  options: StoreWiringOptions | undefined
): Promise<SessionInfo | null> {
  const secret = options?.secret

  const cmsToken = readCookie(req, 'cms_session')
  if (cmsToken && options?.validateCmsSession) {
    const userId = await options.validateCmsSession(cmsToken)
    if (userId !== null) {
      return { id: cmsToken, userId }
    }
    // Stale login (e.g. after logout) degrades to an anonymous identity
  }

  if (secret === undefined) {
    // Legacy presence check
    const raw = readSessionToken(req) ?? cmsToken
    return raw !== null ? { id: raw } : null
  }

  const token = readSessionToken(req)
  if (token !== null) {
    const verified = verifySignedSessionId(secret, token)
    return verified !== null ? { id: verified } : null
  }

  const minted = mintSignedSessionId(secret)
  res.setHeader('Set-Cookie', buildStoreSessionCookie(minted))
  const dot = minted.indexOf('.')
  return { id: minted.slice(0, dot) }
}

function sendJson (res: ServerResponse, statusCode: number, payload: { readonly [key: string]: unknown }): void {
  const body = JSON.stringify(payload)
  res.writeHead(statusCode, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
  res.end(body)
}

function rejectNoSession (res: ServerResponse): void {
  sendJson(res, 401, { error: { code: 'UNAUTHORIZED', message: 'No valid session — include a signed session_id cookie, X-Session-Id header, or cms_session login' } })
}

function rejectAnonymous (res: ServerResponse): void {
  sendJson(res, 403, { error: { code: 'FORBIDDEN', message: 'User-scoped stores require an authenticated session' } })
}

const ERROR_STATUS: Readonly<Record<string, number>> = Object.freeze({
  VALIDATION_FAILED: 400,
  INVALID_MUTATION: 404,
  STORE_NOT_FOUND: 404
})

export interface StoreWiringOptions {
  readonly pool?: StorePool
  readonly log?: (msg: string) => void
  /** HMAC secret for signed anonymous sessions — CMS_SECRET in production */
  readonly secret?: string
  /** Resolves a cms_session token to a userId, or null when invalid */
  readonly validateCmsSession?: (sessionId: string) => Promise<string | null>
  /** URL of the bundled client entry — when set, store-referencing pages
   *  get a module script tag injected alongside their hydration tags. */
  readonly clientScriptUrl?: string
}

/**
 * Injects <script data-store-hydrate> tags into a rendered page for every
 * registered store the page references via data-store attributes, so
 * first paint carries the caller's state without a fetch.
 */
export type StoreHydrator = (req: IncomingMessage, res: ServerResponse, html: string) => Promise<string>

export function registerStoreRoutesOnServer (
  storeInputs: readonly StoreInput[],
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  options?: StoreWiringOptions
): StoreHydrator {
  const broadcaster = SSEBroadcaster.create()
  const log = options?.log ?? (() => {})
  const hydratable: Array<{ slug: string; scope: string; getState: (session: SessionInfo) => ReturnType<ReturnType<typeof registerStoreRoutes>['getState']> }> = []

  // User-scoped stores persist to postgres, as does any store that opts in
  // via persist: true; the table is ensured once and every state query
  // waits on that. Failure degrades loudly, not silently.
  const isPersisted = (input: { readonly scope: string; readonly persist?: boolean }): boolean =>
    input.scope === 'user' || (input.persist === true && input.scope !== 'page')
  const wantsPersistence = options?.pool !== undefined && storeInputs.some(isPersisted)
  const tableReady: Promise<void> = wantsPersistence
    ? options!.pool!.query(STORE_STATES_DDL).then(
      () => undefined,
      (cause: unknown) => {
        log(`store_states table creation failed — user-scope persistence degraded: ${cause instanceof Error ? cause.message : 'unknown'}`)
      }
    )
    : Promise.resolve()

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

    let holder: StateBackend = SessionStateHolder.create(config.fields)
    if (isPersisted(config) && options?.pool) {
      const gatedPool: StorePool = {
        query: async (...args: readonly string[]) => {
          await tableReady
          return await options.pool!.query(...args)
        }
      }
      holder = PostgresStateHolder.create({ pool: gatedPool, slug: config.slug, fields: config.fields })
    }
    const routes = registerStoreRoutes(config, holder, broadcaster, options?.pool)
    hydratable.push({ slug: config.slug, scope: config.scope, getState: (session) => routes.getState(session) })

    const requireIdentity = async (req: IncomingMessage, res: ServerResponse): Promise<SessionInfo | null> => {
      const identity = await resolveIdentity(req, res, options)
      if (identity === null) {
        rejectNoSession(res)
        return null
      }
      if (config.scope === 'user' && identity.userId === undefined) {
        rejectAnonymous(res)
        return null
      }
      return identity
    }

    // POST /store/:slug/:mutation — execute mutation
    registerRoute('POST', `/store/${config.slug}/:mutation`, async (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => {
      const identity = await requireIdentity(req, res)
      if (identity === null) return
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

      const result = await routes.handleMutation(identity, mutationName, args, clientMutationId)

      if (result.isOk()) {
        let fragmentPayload: { selector: string; html: string } | null = null
        if (config.fragment) {
          const fragmentResult = renderStoreFragment(config, result.value.state)
          if (fragmentResult.isOk()) {
            fragmentPayload = { ...fragmentResult.value }
            // Scope decides the SSE audience, mirroring the state event:
            // global fans out, user reaches every session of the user,
            // session reaches only the session's tabs.
            if (config.scope === 'global') {
              broadcaster.broadcast(config.slug, 'fragment', fragmentPayload)
            } else if (config.scope === 'user' && identity.userId !== undefined) {
              broadcaster.sendToUser(config.slug, identity.userId, 'fragment', fragmentPayload)
            } else {
              broadcaster.sendToSession(config.slug, identity.id, 'fragment', fragmentPayload)
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

    // GET /store/:slug/state — current state for the identity's bucket
    registerRoute('GET', `/store/${config.slug}/state`, async (req: IncomingMessage, res: ServerResponse) => {
      const identity = await requireIdentity(req, res)
      if (identity === null) return
      const state = await routes.getState(identity)
      const body = JSON.stringify(state)
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
      res.end(body)
    })

    // GET /store/:slug/events — SSE endpoint
    registerRoute('GET', `/store/${config.slug}/events`, async (req: IncomingMessage, res: ServerResponse) => {
      const identity = await requireIdentity(req, res)
      if (identity === null) return
      broadcaster.addClient(config.slug, identity.id, res, identity.userId)
    })

    // GET /store/:slug/hydration — hydration script tag
    registerRoute('GET', `/store/${config.slug}/hydration`, async (req: IncomingMessage, res: ServerResponse) => {
      const identity = await requireIdentity(req, res)
      if (identity === null) return
      const state = await routes.getState(identity)
      const html = renderStoreHydration(config.slug, state)
      res.writeHead(200, { 'Content-Type': 'text/html', 'Content-Length': String(Buffer.byteLength(html)) })
      res.end(html)
    })
  }

  return async (req, res, html) => {
    // Only pages that actually bind a registered store get tags — and only
    // those resolve an identity, so plain pages never mint session cookies.
    const referenced = hydratable.filter(entry => html.includes(`data-store="${entry.slug}"`))
    if (referenced.length === 0) return html

    let tags = ''
    const identity = await resolveIdentity(req, res, options)
    if (identity !== null) {
      for (const entry of referenced) {
        // Anonymous visitors get no user-scoped state — the client falls back
        // to its authenticated fetch path, which enforces 403 properly.
        if (entry.scope === 'user' && identity.userId === undefined) continue
        const state = await entry.getState(identity)
        tags += renderStoreHydration(entry.slug, state)
      }
    }
    // The runtime ships with the page that needs it — module scripts defer
    // until the DOM (including the hydration tags above) is parsed.
    if (options?.clientScriptUrl !== undefined) {
      tags += `<script type="module" src="${options.clientScriptUrl}"></script>`
    }
    if (tags.length === 0) return html

    const closeBody = html.indexOf('</body>')
    if (closeBody !== -1) {
      return html.slice(0, closeBody) + tags + html.slice(closeBody)
    }
    return html + tags
  }
}

export function maybeRegisterStores (
  stores: readonly StoreInput[] | undefined,
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  logFn?: (msg: string) => void,
  dbPool?: DbPool,
  secret?: string,
  clientScriptUrl?: string
): StoreHydrator | undefined {
  if (!stores || stores.length === 0) return undefined
  const options: StoreWiringOptions = {
    ...(logFn ? { log: logFn } : {}),
    ...(secret !== undefined ? { secret } : {}),
    ...(clientScriptUrl !== undefined ? { clientScriptUrl } : {}),
    ...(dbPool
      ? {
          pool: {
            query: async (...args: readonly string[]) => {
              const [text, ...params] = args
              return await dbPool.sql.unsafe(text ?? '', [...params])
            }
          },
          validateCmsSession: (sessionId: string) =>
            validateSession(sessionId, dbPool).match(
              (userId) => userId,
              () => null
            )
        }
      : {})
  }
  const hydrator = registerStoreRoutesOnServer(stores, registerRoute, options)
  if (logFn) logFn(`Registered ${stores.length} store(s)`)
  return hydrator
}
