import type { IncomingMessage, ServerResponse } from 'node:http'
import { setSecurityHeaders, generateNonce } from './security-headers.js'
import { ResultAsync } from 'neverthrow'
import { ServerErrorCode } from './server-types.js'
import type { RouteHandler, RouteEntry, ServerRouter } from './server-types.js'
import { sendError } from './http-helpers.js'

export { ServerErrorCode }

async function safeDispatch<TCtx> (
  handler: RouteHandler<TCtx>,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: TCtx,
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

export function createServerRouter<TCtx> (): ServerRouter<TCtx> {
  const routes = new Map<string, RouteEntry<TCtx>>()

  function register (path: string, entry: RouteEntry<TCtx>): void {
    routes.set(path, entry)
  }

  async function handle (req: IncomingMessage, res: ServerResponse, ctx: TCtx): Promise<void> {
    const nonce = generateNonce()
    setSecurityHeaders(res, { nonce })
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const pathname = url.pathname
    const method = req.method ?? 'GET'

    const entry = routes.get(pathname)

    if (!entry) {
      const notFoundEntry = routes.get('/404')
      if (notFoundEntry?.GET) {
        await safeDispatch(notFoundEntry.GET, req, res, ctx, pathname)
        return
      }
      sendError(res, { code: ServerErrorCode.NOT_FOUND, message: `Not found: ${pathname}`, statusCode: 404 })
      return
    }

    const handler: RouteHandler<TCtx> | undefined = entry[method as keyof RouteEntry<TCtx>]

    if (!handler) {
      sendError(res, { code: ServerErrorCode.METHOD_NOT_ALLOWED, message: `Method ${method} not allowed on ${pathname}`, statusCode: 405 })
      return
    }

    await safeDispatch(handler, req, res, ctx, pathname)
  }

  return { register, handle }
}
