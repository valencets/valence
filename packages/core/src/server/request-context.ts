import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import { fromThrowable } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { RequestContext } from './middleware-types.js'
import { ServerErrorCode } from './server-types.js'
import type { ServerError } from './server-types.js'

const parseUrlFromRequest = fromThrowable(
  (req: IncomingMessage): URL => new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`),
  (): ServerError => ({
    code: ServerErrorCode.VALIDATION_ERROR,
    message: 'Invalid request URL',
    statusCode: 400
  })
)

export function parseRequestUrl (req: IncomingMessage): Result<URL, ServerError> {
  return parseUrlFromRequest(req)
}

export function createRequestContext (
  req: IncomingMessage,
  params: Readonly<Record<string, string>> | undefined,
  url: URL
): RequestContext {
  return {
    requestId: randomUUID(),
    startTime: process.hrtime(),
    url,
    params: params ?? {}
  }
}
