import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import { getMimeType } from './media-config.js'
import type { StorageAdapter } from './storage-adapter.js'

const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

function sendFile (res: ServerResponse, filename: string, data: Buffer): void {
  res.writeHead(200, {
    'Content-Type': getMimeType(filename),
    'Content-Length': data.length,
    'Cache-Control': 'public, max-age=31536000, immutable'
  })
  res.end(data)
}

function sendError (res: ServerResponse, status: number, error: string): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error }))
}

export function createServeHandler (
  uploadDir: string,
  storage?: StorageAdapter
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const resolvedUploadDir = resolve(uploadDir)

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawFilename = req.url?.split('/').pop()
    if (!rawFilename) {
      sendError(res, 400, 'Missing filename')
      return
    }

    const filename = basename(rawFilename)
    if (!SAFE_FILENAME_RE.test(filename)) {
      sendError(res, 400, 'Invalid filename')
      return
    }

    if (storage) {
      const result = await storage.read(filename)
      if (result.isErr()) {
        sendError(res, 404, 'File not found')
        return
      }
      sendFile(res, filename, result.value)
      return
    }

    const filePath = resolve(join(resolvedUploadDir, filename))
    if (!filePath.startsWith(resolvedUploadDir)) {
      sendError(res, 403, 'Forbidden')
      return
    }

    const result = await ResultAsync.fromPromise(
      readFile(filePath),
      (e: unknown): CmsError => ({
        code: CmsErrorCode.NOT_FOUND,
        message: e instanceof Error ? e.message : 'File read failed'
      })
    )

    if (result.isErr()) {
      sendError(res, 404, 'File not found')
      return
    }

    sendFile(res, filename, result.value)
  }
}

export function buildMediaUrl (filename: string, sizeName?: string): string {
  const base = basename(filename)
  if (!sizeName) return `/media/${encodeURIComponent(base)}`

  const dotIndex = base.lastIndexOf('.')
  if (dotIndex === -1) {
    return `/media/${encodeURIComponent(`${base}-${sizeName}`)}`
  }
  const nameWithoutExt = base.slice(0, dotIndex)
  const ext = base.slice(dotIndex + 1)
  return `/media/${encodeURIComponent(`${nameWithoutExt}-${sizeName}.${ext}`)}`
}
