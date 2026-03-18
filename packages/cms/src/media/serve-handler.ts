import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import { getMimeType } from './media-config.js'

const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

export function createServeHandler (uploadDir: string): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const resolvedUploadDir = resolve(uploadDir)

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const rawFilename = req.url?.split('/').pop()
    if (!rawFilename) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing filename' }))
      return
    }

    const filename = basename(rawFilename)
    if (!SAFE_FILENAME_RE.test(filename)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid filename' }))
      return
    }

    const filePath = resolve(join(resolvedUploadDir, filename))
    if (!filePath.startsWith(resolvedUploadDir)) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Forbidden' }))
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
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'File not found' }))
      return
    }

    const data = result.value
    const contentType = getMimeType(filename)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
    res.end(data)
  }
}
