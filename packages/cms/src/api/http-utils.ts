import type { ServerResponse } from 'node:http'
import type { IncomingMessage } from 'node:http'
import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { DocumentData } from '../db/query-builder.js'
import { readStringBody } from './read-body.js'

export function sendJson (res: ServerResponse, data: DocumentData | readonly DocumentData[], statusCode: number = 200): void {
  const body = JSON.stringify(data)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

export function sendErrorJson (res: ServerResponse, message: string, statusCode: number): void {
  const body = JSON.stringify({ error: message })
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

export function safeReadBody (req: IncomingMessage): ResultAsync<string, CmsError> {
  return readStringBody(req)
}

export function safeJsonParse (body: string): ResultAsync<DocumentData, CmsError> {
  return ResultAsync.fromPromise(
    Promise.resolve().then(() => JSON.parse(body) as DocumentData),
    (): CmsError => ({
      code: CmsErrorCode.INVALID_INPUT,
      message: 'Invalid JSON in request body'
    })
  )
}
