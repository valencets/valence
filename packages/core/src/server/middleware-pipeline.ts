import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext, Middleware } from './middleware-types.js'

export function composeMiddleware (
  middlewares: readonly Middleware[]
): (req: IncomingMessage, res: ServerResponse, ctx: RequestContext, final: () => Promise<void>) => Promise<void> {
  return async (req, res, ctx, final) => {
    async function dispatch (i: number): Promise<void> {
      if (i >= middlewares.length) {
        await final()
        return
      }
      const mw = middlewares[i]
      if (mw) {
        await mw(req, res, ctx, () => dispatch(i + 1))
      }
    }

    await dispatch(0)
  }
}
