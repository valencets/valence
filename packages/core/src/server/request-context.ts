import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { RequestContext } from './middleware-types.js'
import { fromThrowable } from '@valencets/resultkit'

const safeRequestUrl = fromThrowable(
  (req: IncomingMessage) => new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`),
  () => null
)

export function parseRequestUrl (req: IncomingMessage): URL | null {
  const result = safeRequestUrl(req)
  return result.isOk() ? result.value : null
}

export function createRequestContext (
  req: IncomingMessage,
  params?: Readonly<Record<string, string>>
): RequestContext {
  return {
    requestId: randomUUID(),
    startTime: process.hrtime(),
    url: parseRequestUrl(req) ?? new URL(req.url ?? '/', 'http://localhost'),
    params: params ?? {}
  }
}
