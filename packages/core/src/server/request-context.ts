import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { RequestContext } from './middleware-types.js'

export function createRequestContext (
  req: IncomingMessage,
  params?: Readonly<Record<string, string>>
): RequestContext {
  return {
    requestId: randomUUID(),
    startTime: process.hrtime(),
    url: new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`),
    params: params ?? {}
  }
}
