import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ServerError } from './server-types.js'

export function sendHtml (res: ServerResponse, html: string, statusCode: number = 200): void {
  res.writeHead(statusCode, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html)
  })
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
  return req.headers['x-inertia-fragment'] === '1'
}

export function readBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}
