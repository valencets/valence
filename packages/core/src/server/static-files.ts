import { resolve, normalize, extname } from 'node:path'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { ServerError } from './server-types.js'
import { ServerErrorCode } from './server-types.js'

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8'
}

export function resolveMimeType (filename: string): string {
  const ext = extname(filename).toLowerCase()
  return MIME_TYPES[ext] ?? 'application/octet-stream'
}

export function resolveStaticPath (requestPath: string, rootDir: string): Result<string, ServerError> {
  // Reject null bytes
  if (requestPath.includes('\0')) {
    return err({ code: ServerErrorCode.NOT_FOUND, message: 'Invalid path', statusCode: 404 })
  }

  // Reject backslashes (raw and percent-encoded)
  if (requestPath.includes('\\') || requestPath.includes('%5c') || requestPath.includes('%5C')) {
    return err({ code: ServerErrorCode.NOT_FOUND, message: 'Invalid path', statusCode: 404 })
  }

  // Reject control characters (U+0001–U+001F)
  for (let i = 0; i < requestPath.length; i++) {
    const code = requestPath.charCodeAt(i)
    if (code >= 1 && code <= 0x1f) {
      return err({ code: ServerErrorCode.NOT_FOUND, message: 'Invalid path', statusCode: 404 })
    }
  }

  // Decode and normalize
  const decoded = decodeURIComponent(requestPath)
  const normalized = normalize(decoded)
  const fullPath = resolve(rootDir, '.' + normalized)

  // Path traversal check: resolved path must start with root
  if (!fullPath.startsWith(resolve(rootDir))) {
    return err({ code: ServerErrorCode.NOT_FOUND, message: 'Path traversal rejected', statusCode: 404 })
  }

  return ok(fullPath)
}
