import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { writeFile } from 'node:fs/promises'
import { join, resolve, basename } from 'node:path'
import { randomBytes } from 'node:crypto'
import { getMimeType } from './media-config.js'
import { readRawBody } from '../api/read-body.js'

const MAX_UPLOAD_BYTES = 10_485_760
const SAFE_FILENAME_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/

function generateStoredName (originalName: string): string {
  const ext = originalName.split('.').pop() ?? ''
  const prefix = randomBytes(16).toString('hex')
  return ext ? `${prefix}.${ext}` : prefix
}

export interface UploadResult {
  readonly filename: string
  readonly storedPath: string
  readonly mimeType: string
  readonly filesize: number
}

export function createUploadHandler (uploadDir: string): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  const resolvedDir = resolve(uploadDir)

  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const filenameHeader = req.headers['x-filename']
    const rawName = Array.isArray(filenameHeader) ? filenameHeader[0] ?? 'upload' : filenameHeader ?? 'upload'
    const originalName = basename(rawName)
    if (!SAFE_FILENAME_RE.test(originalName)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid filename' }))
      return
    }

    const bodyResult = await readRawBody(req, MAX_UPLOAD_BYTES)
    if (bodyResult.isErr()) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: bodyResult.error.message }))
      return
    }

    const data = bodyResult.value
    const storedName = generateStoredName(originalName)
    const storedPath = resolve(join(resolvedDir, storedName))
    if (!storedPath.startsWith(resolvedDir)) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Forbidden' }))
      return
    }

    const writeResult = await ResultAsync.fromPromise(
      writeFile(storedPath, data),
      (e: unknown): CmsError => ({
        code: CmsErrorCode.INTERNAL,
        message: e instanceof Error ? e.message : 'File write failed'
      })
    )

    if (writeResult.isErr()) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: writeResult.error.message }))
      return
    }

    const result: UploadResult = {
      filename: originalName,
      storedPath: storedName,
      mimeType: getMimeType(originalName),
      filesize: data.length
    }

    const body = JSON.stringify(result)
    res.writeHead(201, {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Length': Buffer.byteLength(body)
    })
    res.end(body)
  }
}
