import type { IncomingMessage, ServerResponse } from 'node:http'
import { ResultAsync } from '@valencets/resultkit'
import { parseCookie } from '@valencets/cms'
import type { CmsInstance } from '@valencets/cms'
import type { RouteHandler } from './define-config.js'

/**
 * #350 — mount the GraphQL endpoint the config promises. `graphql: true`
 * was validated by defineConfig but nothing mounted POST /graphql.
 *
 * Auth posture: the derived resolvers perform no per-collection access
 * checks yet, so the whole endpoint requires a validated cms_session —
 * the same auth-by-default stance REST takes for collections without
 * access functions. Per-collection access in resolvers is future work.
 *
 * @valencets/graphql loads lazily so graphql-js stays out of boots that
 * never enable it.
 */
export async function maybeRegisterGraphQL (
  enabled: boolean | undefined,
  registerRoute: (method: string, path: string, handler: RouteHandler) => void,
  cms: CmsInstance,
  validateCmsSession: (sessionId: string) => Promise<string | null>,
  logFn?: (msg: string) => void
): Promise<boolean> {
  if (enabled !== true) return false

  const imported = await ResultAsync.fromPromise(
    import('@valencets/graphql'),
    (e) => e
  )
  if (imported.isErr()) {
    const cause = imported.error
    if (logFn) logFn(`graphql: true but @valencets/graphql failed to load: ${cause instanceof Error ? cause.message : 'unknown'}`)
    return false
  }

  const { createGraphQLRoutes } = imported.value
  const routes = createGraphQLRoutes(cms)
  const entry = routes.get('/graphql')
  const handler = entry?.POST
  if (handler === undefined) {
    if (logFn) logFn('graphql: createGraphQLRoutes returned no POST /graphql handler')
    return false
  }

  const sendUnauthorized = (res: ServerResponse): void => {
    const body = JSON.stringify({ errors: [{ message: 'Unauthorized: a valid cms_session is required.' }] })
    res.writeHead(401, { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(body)) })
    res.end(body)
  }

  registerRoute('POST', '/graphql', async (req: IncomingMessage, res: ServerResponse) => {
    const sessionId = parseCookie(req.headers.cookie ?? '', 'cms_session')
    if (!sessionId) {
      sendUnauthorized(res)
      return
    }
    const userId = await validateCmsSession(sessionId)
    if (userId === null) {
      sendUnauthorized(res)
      return
    }
    await handler(req, res, {})
  })

  if (logFn) logFn('GraphQL endpoint mounted at POST /graphql (cms_session required)')
  return true
}
