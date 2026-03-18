import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ServerError } from './server-types.js'
import { cacheControl } from './cache-control.js'

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

export function sendJson (res: ServerResponse, data: unknown, statusCode: number = 200): void {
  const body = JSON.stringify(data)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

export function sendError (res: ServerResponse, error: ServerError): void {
  sendHtml(res, `<h1>${error.statusCode}</h1><p>${error.message}</p>`, error.statusCode)
}

export function isFragmentRequest (req: IncomingMessage): boolean {
  return req.headers['x-valence-fragment'] === '1'
}

// 1 MiB — generous for HTML form posts, blocks abuse
export const MAX_BODY_BYTES = 1_048_576

export function readBody (req: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let received = 0
    req.on('data', (chunk: Buffer) => {
      received += chunk.length
      if (received > maxBytes) {
        req.removeAllListeners('data')
        reject(new Error(`Body exceeds ${maxBytes} bytes`))
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
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
