import { randomUUID } from 'node:crypto'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { ResultAsync } from '@valencets/resultkit'
import type { Logger } from './logger.js'

// A plain node http handler. The valence dev/start servers dispatch with this
// shape; wrapping it keeps request logging orthogonal to routing.
export type RequestLogHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function requestPath (req: IncomingMessage): string {
  const raw = req.url ?? '/'
  const query = raw.indexOf('?')
  return query === -1 ? raw : raw.slice(0, query)
}

function elapsedMs (startNs: bigint): number {
  const deltaNs = process.hrtime.bigint() - startNs
  // Microsecond resolution is plenty for a request line and keeps the number
  // small and JSON-friendly.
  return Number(deltaNs / 1_000n) / 1000
}

// Wrap a request handler so every request gets a generated id (echoed as
// `X-Request-Id`), a structured completion line, and an error boundary that
// turns an unexpected rejection into a logged 500 instead of a crashed
// process. The id is minted here rather than trusted from the client so it
// cannot be used for log injection or trace-forging.
export function withRequestLogging (logger: Logger, handler: RequestLogHandler): RequestLogHandler {
  return async (req, res) => {
    const requestId = randomUUID()
    const startNs = process.hrtime.bigint()
    const method = req.method ?? 'GET'
    const path = requestPath(req)

    res.setHeader('X-Request-Id', requestId)

    res.on('finish', () => {
      logger.info('request', { requestId, method, path, status: res.statusCode, durationMs: elapsedMs(startNs) })
    })

    const outcome = await ResultAsync.fromPromise(
      handler(req, res),
      (err) => err instanceof Error ? err : new Error(String(err))
    )

    if (outcome.isErr()) {
      logger.error('request failed', { requestId, method, path, error: outcome.error.message })
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
        res.end('Internal Server Error')
      } else if (!res.writableEnded) {
        res.end()
      }
    }
  }
}
