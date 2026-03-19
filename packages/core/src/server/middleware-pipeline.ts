import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext, Middleware } from './middleware-types.js'

export function composeMiddleware (
  middlewares: readonly Middleware[]
): (req: IncomingMessage, res: ServerResponse, ctx: RequestContext, final: () => Promise<void>) => Promise<void> {
  return async (req, res, ctx, final) => {
    let index = -1

    async function dispatch (i: number): Promise<void> {
      if (i <= index) {
        throw new Error('next() called multiple times')
      }
      index = i
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
