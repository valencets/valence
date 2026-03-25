import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Middleware } from './middleware-types.js'
import { readBody } from './http-helpers.js'
import { ResultAsync } from '@valencets/resultkit'

export const ContentCategory = {
  JSON: 'json',
  FORM: 'form',
  MULTIPART: 'multipart',
  BEACON: 'beacon',
  RAW: 'raw'
} as const

export type ContentCategory = typeof ContentCategory[keyof typeof ContentCategory]

export interface BodyLimitConfig {
  readonly json?: number
  readonly form?: number
  readonly multipart?: number
  readonly beacon?: number
  readonly raw?: number
}

interface ResolvedLimits {
  readonly json: number
  readonly form: number
  readonly multipart: number
  readonly beacon: number
  readonly raw: number
}

interface ReadableBodyRequest extends IncomingMessage {
  on(event: 'data', listener: (chunk: Buffer) => void): this
  on(event: 'end' | 'error' | 'close', listener: () => void): this
}

const DEFAULT_LIMITS: ResolvedLimits = {
  json: 102_400,
  form: 102_400,
  multipart: 10_485_760,
  beacon: 65_536,
  raw: 1_048_576
}

const BODY_METHODS: Record<string, true> = {
  POST: true,
  PUT: true,
  PATCH: true,
  DELETE: true
}

const CONTENT_TYPE_MAP: Record<string, ContentCategory> = {
  'application/json': ContentCategory.JSON,
  'application/x-www-form-urlencoded': ContentCategory.FORM,
  'multipart/form-data': ContentCategory.MULTIPART,
  'text/plain': ContentCategory.RAW,
  'application/octet-stream': ContentCategory.RAW
}

export function resolveContentCategory (contentType: string | undefined): ContentCategory {
  if (contentType === undefined) {
    return ContentCategory.RAW
  }
  const base = contentType.split(';')[0]?.trim().toLowerCase()
  if (base === undefined) {
    return ContentCategory.RAW
  }
  return CONTENT_TYPE_MAP[base] ?? ContentCategory.RAW
}

function send413 (res: ServerResponse): void {
  const body = JSON.stringify({ error: 'Request entity too large' })
  res.writeHead(413, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function canTrackStream (req: IncomingMessage): req is ReadableBodyRequest {
  return typeof req.on === 'function'
}

function validateReadableBody (req: ReadableBodyRequest, limit: number): ResultAsync<void, Error> {
  return ResultAsync.fromPromise(
    readBody(req, limit).then(() => undefined),
    (error) => error instanceof Error ? error : new Error(String(error))
  )
}

export function createBodyLimitMiddleware (config?: BodyLimitConfig): Middleware {
  const limits: ResolvedLimits = {
    json: config?.json ?? DEFAULT_LIMITS.json,
    form: config?.form ?? DEFAULT_LIMITS.form,
    multipart: config?.multipart ?? DEFAULT_LIMITS.multipart,
    beacon: config?.beacon ?? DEFAULT_LIMITS.beacon,
    raw: config?.raw ?? DEFAULT_LIMITS.raw
  }

  const middleware: Middleware = async (req, res, _ctx, next) => {
    const method = req.method ?? 'GET'
    if (BODY_METHODS[method] !== true) {
      await next()
      return
    }

    const contentType = req.headers['content-type']
    const category = resolveContentCategory(typeof contentType === 'string' ? contentType : undefined)
    const limit = limits[category]
    const contentLength = req.headers['content-length']

    if (contentLength !== undefined) {
      const length = parseInt(contentLength, 10)
      if (Number.isNaN(length)) {
        const result = await validateReadableBody(req, limit)
        if (result.isErr()) {
          send413(res)
          return
        }
        await next()
        return
      }

      if (length > limit) {
        send413(res)
        return
      }

      if (!canTrackStream(req)) {
        send413(res)
        return
      }

      const result = await validateReadableBody(req, limit)
      if (result.isErr()) {
        send413(res)
        return
      }

      await next()
      return
    }

    // No Content-Length header — enforce limit via streaming byte counter
    if (!canTrackStream(req)) {
      send413(res)
      return
    }

    const result = await validateReadableBody(req, limit)
    if (result.isErr()) {
      send413(res)
      return
    }

    await next()
  }

  return middleware
}
