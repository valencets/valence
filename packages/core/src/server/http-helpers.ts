import type { IncomingMessage, ServerResponse } from 'node:http'
import { cacheControl } from './cache-control.js'
import type { ServerError } from './server-types.js'

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
interface JsonObject {
  readonly [key: string]: JsonValue | undefined
}
type JsonArray = ReadonlyArray<JsonValue>

const CACHED_RAW_BODY = Symbol('cached-raw-body')

interface CachedBodyRequest extends IncomingMessage {
  [CACHED_RAW_BODY]?: string
}

function escapeHtml (value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

export function sendHtml (
  res: ServerResponse,
  html: string,
  statusCode: number = 200,
  extraHeaders?: Record<string, string | number>
): void {
  const headers: Record<string, string | number> = {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    ...extraHeaders
  }
  res.writeHead(statusCode, headers)
  res.end(html)
}

export function sendJson (res: ServerResponse, data: JsonValue, statusCode: number = 200): void {
  const body = JSON.stringify(data)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

export function sendError (res: ServerResponse, error: ServerError): void {
  sendHtml(res, `<h1>${error.statusCode}</h1><p>${escapeHtml(error.message)}</p>`, error.statusCode)
}

export function isFragmentRequest (req: IncomingMessage): boolean {
  return req.headers['x-valence-fragment'] === '1'
}

export const MAX_BODY_BYTES = 1_048_576

export function readBody (req: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<string> {
  const cachedReq = req as CachedBodyRequest
  if (cachedReq[CACHED_RAW_BODY] !== undefined) {
    return Promise.resolve(cachedReq[CACHED_RAW_BODY])
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let received = 0
    let settled = false

    function cleanup (): void {
      req.removeListener?.('data', onData)
      req.removeListener?.('end', onEnd)
      req.removeListener?.('error', onError)
      req.removeListener?.('aborted', onAborted)
    }

    function rejectOnce (error: Error): void {
      if (settled) return
      settled = true
      cleanup()
      reject(error)
    }

    function resolveOnce (body: string): void {
      if (settled) return
      settled = true
      cleanup()
      resolve(body)
    }

    function onData (chunk: Buffer): void {
      received += chunk.length
      if (received > maxBytes) {
        rejectOnce(new Error(`Body exceeds ${maxBytes} bytes`))
        return
      }
      chunks.push(chunk)
    }

    function onEnd (): void {
      const body = Buffer.concat(chunks).toString('utf-8')
      cachedReq[CACHED_RAW_BODY] = body
      resolveOnce(body)
    }

    function onError (error: Error): void {
      rejectOnce(error)
    }

    function onAborted (): void {
      rejectOnce(new Error('Request body aborted'))
    }

    req.on('data', onData)
    req.on('end', onEnd)
    req.on('error', onError)
    req.on('aborted', onAborted)
  })
}

export interface IslandHtmlOptions {
  readonly maxAge?: number
}

export function sendIslandHtml (
  res: ServerResponse,
  html: string,
  options?: IslandHtmlOptions
): void {
  const headers: Record<string, string | number> = {
    'X-Valence-Fragment': '1'
  }
  if (options?.maxAge !== undefined) {
    headers['Cache-Control'] = cacheControl('island', { maxAge: options.maxAge })
  }
  sendHtml(res, html, 200, headers)
}
