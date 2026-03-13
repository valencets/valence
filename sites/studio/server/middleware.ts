import { readFile } from 'node:fs/promises'
import { join, extname } from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'

const STATIC_ROOT = join(import.meta.dirname, '..', 'public')

const MIME_MAP: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
}

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'"
}

export function applySecurityHeaders (res: ServerResponse): void {
  for (const key of Object.keys(SECURITY_HEADERS)) {
    const value = SECURITY_HEADERS[key]
    if (value) {
      res.setHeader(key, value)
    }
  }
}

export async function tryServeStatic (req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const pathname = url.pathname

  // Only serve files with extensions (not routes)
  if (!extname(pathname)) {
    return false
  }

  // Prevent directory traversal
  const normalizedPath = join(STATIC_ROOT, pathname)
  if (!normalizedPath.startsWith(STATIC_ROOT)) {
    return false
  }

  const ext = extname(pathname)
  const mime = MIME_MAP[ext]

  if (!mime) {
    return false
  }

  const content = await readFile(normalizedPath).catch(() => null)
  if (!content) {
    return false
  }

  res.writeHead(200, {
    'Content-Type': mime,
    'Content-Length': content.byteLength,
    'Cache-Control': 'public, max-age=31536000, immutable'
  })
  res.end(content)
  return true
}
