import { resolve as resolvePath, normalize, extname } from 'node:path'
import { statSync, createReadStream } from 'node:fs'
import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { ServerResponse } from 'node:http'
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
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.mp4': 'video/mp4',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.flac': 'audio/flac',
  '.webm': 'video/webm'
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

  // Reject control characters (U+0001-U+001F)
  for (let i = 0; i < requestPath.length; i++) {
    const code = requestPath.charCodeAt(i)
    if (code >= 1 && code <= 0x1f) {
      return err({ code: ServerErrorCode.NOT_FOUND, message: 'Invalid path', statusCode: 404 })
    }
  }

  // Decode and normalize
  const decoded = decodeURIComponent(requestPath)
  const normalized = normalize(decoded)
  const fullPath = resolvePath(rootDir, '.' + normalized)

  // Path traversal check: resolved path must start with root
  if (!fullPath.startsWith(resolvePath(rootDir))) {
    return err({ code: ServerErrorCode.NOT_FOUND, message: 'Path traversal rejected', statusCode: 404 })
  }

  return ok(fullPath)
}

// ---------------------------------------------------------------------------
// Range request support
// ---------------------------------------------------------------------------

export interface ByteRange {
  readonly start: number
  readonly end: number
}

/**
 * Parse the HTTP Range header value against a known file size.
 *
 * Returns:
 *   ok(null)      - no Range header, serve full file
 *   ok(ByteRange) - valid range
 *   err(...)      - invalid range, respond 416
 *
 * Only single-range "bytes=start-end" style is supported.
 */
export function parseRangeHeader (
  rangeHeader: string | undefined,
  fileSize: number
): Result<ByteRange | null, ServerError> {
  if (rangeHeader === undefined) {
    return ok(null)
  }

  // Must start with "bytes="
  if (!rangeHeader.startsWith('bytes=')) {
    return err({ code: ServerErrorCode.VALIDATION_ERROR, message: 'Invalid Range header', statusCode: 416 })
  }

  const spec = rangeHeader.slice('bytes='.length)

  // Suffix range: bytes=-N  -> last N bytes
  if (spec.startsWith('-')) {
    const suffixLen = Number(spec.slice(1))
    if (!Number.isFinite(suffixLen) || suffixLen <= 0) {
      return err({ code: ServerErrorCode.VALIDATION_ERROR, message: 'Invalid suffix range', statusCode: 416 })
    }
    const start = Math.max(0, fileSize - suffixLen)
    const end = fileSize - 1
    return ok({ start, end })
  }

  const dashIdx = spec.indexOf('-')
  if (dashIdx === -1) {
    return err({ code: ServerErrorCode.VALIDATION_ERROR, message: 'Invalid Range header', statusCode: 416 })
  }

  const startStr = spec.slice(0, dashIdx)
  const endStr = spec.slice(dashIdx + 1)

  const start = Number(startStr)
  if (!Number.isFinite(start) || startStr === '') {
    return err({ code: ServerErrorCode.VALIDATION_ERROR, message: 'Invalid range start', statusCode: 416 })
  }

  // start beyond file
  if (start >= fileSize) {
    return err({ code: ServerErrorCode.VALIDATION_ERROR, message: 'Range not satisfiable', statusCode: 416 })
  }

  // Open-ended range: bytes=N-
  if (endStr === '') {
    return ok({ start, end: fileSize - 1 })
  }

  const end = Math.min(Number(endStr), fileSize - 1)
  if (!Number.isFinite(end) || end < start) {
    return err({ code: ServerErrorCode.VALIDATION_ERROR, message: 'Range not satisfiable', statusCode: 416 })
  }

  return ok({ start, end })
}

/**
 * Stream a static file to the response, honouring an optional Range header.
 *
 * - No Range header  -> 200, Accept-Ranges: bytes, full file
 * - Valid range      -> 206, Content-Range, partial stream
 * - Invalid range    -> 416
 */
export function serveStaticFile (
  filePath: string,
  mimeType: string,
  rangeHeader: string | undefined,
  res: ServerResponse
): Promise<void> {
  return new Promise((resolve: () => void) => {
    const stat = statSync(filePath)
    const fileSize = stat.size

    const rangeResult = parseRangeHeader(rangeHeader, fileSize)

    if (rangeResult.isErr()) {
      res.writeHead(416, {
        'Content-Range': `bytes */${fileSize}`,
        'Content-Length': 0
      })
      res.end()
      resolve()
      return
    }

    const range = rangeResult.value

    if (range === null) {
      // Full file response
      res.writeHead(200, {
        'Content-Type': mimeType,
        'Content-Length': fileSize,
        'Accept-Ranges': 'bytes'
      })
      const stream = createReadStream(filePath)
      stream.on('end', resolve)
      stream.on('error', () => { res.end(); resolve() })
      stream.pipe(res)
      return
    }

    // Partial content response
    const chunkSize = range.end - range.start + 1
    res.writeHead(206, {
      'Content-Type': mimeType,
      'Content-Range': `bytes ${range.start}-${range.end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize
    })
    const stream = createReadStream(filePath, { start: range.start, end: range.end })
    stream.on('end', resolve)
    stream.on('error', () => { res.end(); resolve() })
    stream.pipe(res)
  })
}
