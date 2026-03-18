import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import { ResultAsync } from 'neverthrow'
import type { CollectionRegistry, GlobalRegistry } from '../schema/registry.js'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import { createLocalApi } from './local-api.js'
import type { DocumentData } from '../db/query-builder.js'
import { generateZodSchema, generatePartialSchema } from '../validation/zod-generator.js'

export type RestRouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

export interface RestRouteEntry {
  readonly GET?: RestRouteHandler | undefined
  readonly POST?: RestRouteHandler | undefined
  readonly PATCH?: RestRouteHandler | undefined
  readonly DELETE?: RestRouteHandler | undefined
}

const MAX_BODY_BYTES = 1_048_576

function sendJson (res: ServerResponse, data: DocumentData | readonly DocumentData[], statusCode: number = 200): void {
  const body = JSON.stringify(data)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function sendErrorJson (res: ServerResponse, message: string, statusCode: number): void {
  const body = JSON.stringify({ error: message })
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function safeReadBody (req: IncomingMessage): ResultAsync<string, CmsError> {
  return ResultAsync.fromPromise(
    new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      let received = 0
      req.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (received > MAX_BODY_BYTES) {
          req.removeAllListeners('data')
          reject(new Error(`Body exceeds ${MAX_BODY_BYTES} bytes`))
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      req.on('error', (e: Error) => reject(e))
    }),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INVALID_INPUT,
      message: e instanceof Error ? e.message : 'Failed to read request body'
    })
  )
}

function safeJsonParse (body: string): ResultAsync<DocumentData, CmsError> {
  return ResultAsync.fromPromise(
    Promise.resolve().then(() => JSON.parse(body) as DocumentData),
    (): CmsError => ({
      code: CmsErrorCode.INVALID_INPUT,
      message: 'Invalid JSON in request body'
    })
  )
}

export function createRestRoutes (
  pool: DbPool,
  collections: CollectionRegistry,
  globals: GlobalRegistry
): Map<string, RestRouteEntry> {
  const api = createLocalApi(pool, collections, globals)
  const routes = new Map<string, RestRouteEntry>()

  for (const col of collections.getAll()) {
    const slug = col.slug
    const zodSchema = generateZodSchema(col.fields)

    routes.set(`/api/${slug}`, {
      GET: async (_req, res) => {
        const result = await api.find({ collection: slug })
        result.match(
          (docs) => sendJson(res, docs as DocumentData[]),
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      POST: async (req, res) => {
        const bodyResult = await safeReadBody(req)
        if (bodyResult.isErr()) { sendErrorJson(res, bodyResult.error.message, 400); return }
        const parseResult = await safeJsonParse(bodyResult.value)
        if (parseResult.isErr()) { sendErrorJson(res, parseResult.error.message, 400); return }
        const validation = zodSchema.safeParse(parseResult.value)
        if (!validation.success) {
          const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
          sendErrorJson(res, `Validation failed: ${issues}`, 400)
          return
        }
        const result = await api.create({ collection: slug, data: parseResult.value })
        result.match(
          (doc) => sendJson(res, doc as DocumentData, 201),
          (err) => sendErrorJson(res, err.message, 400)
        )
      }
    })

    routes.set(`/api/${slug}/:id`, {
      GET: async (req, res) => {
        const id = req.url?.split('/').pop() ?? ''
        const result = await api.findByID({ collection: slug, id })
        result.match(
          (doc) => doc ? sendJson(res, doc as DocumentData) : sendErrorJson(res, 'Not found', 404),
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      PATCH: async (req, res) => {
        const id = req.url?.split('/').pop() ?? ''
        const bodyResult = await safeReadBody(req)
        if (bodyResult.isErr()) { sendErrorJson(res, bodyResult.error.message, 400); return }
        const parseResult = await safeJsonParse(bodyResult.value)
        if (parseResult.isErr()) { sendErrorJson(res, parseResult.error.message, 400); return }
        const partialSchema = generatePartialSchema(col.fields)
        const validation = partialSchema.safeParse(parseResult.value)
        if (!validation.success) {
          const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
          sendErrorJson(res, `Validation failed: ${issues}`, 400)
          return
        }
        const result = await api.update({ collection: slug, id, data: parseResult.value })
        result.match(
          (doc) => sendJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 400)
        )
      },
      DELETE: async (req, res) => {
        const id = req.url?.split('/').pop() ?? ''
        const result = await api.delete({ collection: slug, id })
        result.match(
          (doc) => sendJson(res, doc as DocumentData),
          (err) => sendErrorJson(res, err.message, 500)
        )
      }
    })
  }

  return routes
}
