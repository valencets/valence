import type { IncomingMessage, ServerResponse } from 'node:http'
import { setSecurityHeaders, generateNonce } from './security-headers.js'
import { ResultAsync } from 'neverthrow'
import { ServerErrorCode } from './server-types.js'
import type { RouteHandler, RouteEntry, ServerRouter, RouteOptions } from './server-types.js'
import type { Middleware, ErrorHandler, RequestContext } from './middleware-types.js'
import { sendError } from './http-helpers.js'
import { createRequestContext } from './request-context.js'
import { matchRoute } from './route-matcher.js'
import { composeMiddleware } from './middleware-pipeline.js'

export { ServerErrorCode }

interface StoredRoute {
  readonly entry: RouteEntry
  readonly middleware: readonly Middleware[]
}

export function createServerRouter (): ServerRouter {
  const routes = new Map<string, StoredRoute>()
  const globalMiddleware: Middleware[] = []
  let errorHandler: ErrorHandler | undefined

  function register (path: string, entry: RouteEntry, options?: RouteOptions): void {
    routes.set(path, { entry, middleware: options?.middleware ?? [] })
  }

  function use (middleware: Middleware): void {
    globalMiddleware.push(middleware)
  }

  function onError (handler: ErrorHandler): void {
    errorHandler = handler
  }

  async function handle (req: IncomingMessage, res: ServerResponse): Promise<void> {
    const nonce = generateNonce()
    setSecurityHeaders(res, { nonce })

    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const pathname = url.pathname
    const method = req.method ?? 'GET'

    const patterns = Array.from(routes.keys())
    const match = matchRoute(pathname, patterns)

    const ctx: RequestContext = createRequestContext(req, match?.params)
    res.setHeader('X-Request-Id', ctx.requestId)

    if (!match) {
      const notFound = routes.get('/404')
      if (notFound?.entry.GET) {
        await safeDispatch(notFound.entry.GET, req, res, ctx, pathname)
        return
      }
      sendError(res, { code: ServerErrorCode.NOT_FOUND, message: `Not found: ${pathname}`, statusCode: 404 })
      return
    }

    const stored = routes.get(match.pattern)!
    const handler: RouteHandler | undefined = stored.entry[method as keyof RouteEntry]

    if (!handler) {
      sendError(res, { code: ServerErrorCode.METHOD_NOT_ALLOWED, message: `Method ${method} not allowed on ${pathname}`, statusCode: 405 })
      return
    }

    const allMiddleware = [...globalMiddleware, ...stored.middleware]
    const pipeline = composeMiddleware(allMiddleware)

    const result = await ResultAsync.fromPromise(
      pipeline(req, res, ctx, () => handler(req, res, ctx)),
      (err) => err instanceof Error ? err : new Error(String(err))
    )

    if (result.isErr()) {
      if (errorHandler) {
        await errorHandler(result.error, req, res, ctx)
        return
      }
      console.error(`[server-router] unhandled error on ${pathname}:`, result.error.message)
      if (!res.headersSent) {
        sendError(res, { code: ServerErrorCode.INTERNAL_ERROR, message: 'Internal server error', statusCode: 500 })
      }
    }
  }

  async function safeDispatch (
    handler: RouteHandler,
    req: IncomingMessage,
    res: ServerResponse,
    ctx: RequestContext,
    pathname: string
  ): Promise<void> {
    const result = await ResultAsync.fromPromise(
      handler(req, res, ctx),
      (err) => err instanceof Error ? err : new Error(String(err))
    )
    if (result.isErr()) {
      console.error(`[server-router] unhandled error on ${pathname}:`, result.error.message)
      if (!res.headersSent) {
        sendError(res, { code: ServerErrorCode.INTERNAL_ERROR, message: 'Internal server error', statusCode: 500 })
      }
    }
  }

  return { register, use, onError, handle }
}
