import type { IncomingMessage } from 'node:http'
import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'

const MAX_BODY_BYTES = 1_048_576

export function readRawBody (req: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): ResultAsync<Buffer, CmsError> {
  return ResultAsync.fromPromise(
    new Promise<Buffer>((resolve, reject) => {
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
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', (e: Error) => reject(e))
    }),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INVALID_INPUT,
      message: e instanceof Error ? e.message : 'Failed to read request body'
    })
  )
}

export function readStringBody (req: IncomingMessage, maxBytes: number = MAX_BODY_BYTES): ResultAsync<string, CmsError> {
  return readRawBody(req, maxBytes).map(buf => buf.toString('utf-8'))
}
