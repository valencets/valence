import type { IncomingMessage, ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getMimeType } from './media-config.js'

export function createServeHandler (uploadDir: string) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    const filename = req.url?.split('/').pop()
    if (!filename) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing filename' }))
      return
    }

    const filePath = join(uploadDir, filename)

    const data = await readFile(filePath).catch(() => null)
    if (!data) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'File not found' }))
      return
    }

    const contentType = getMimeType(filename)
    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': data.length,
      'Cache-Control': 'public, max-age=31536000, immutable'
    })
    res.end(data)
  }
}
