import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry, GlobalRegistry } from '../schema/registry.js'
import { createLocalApi } from './local-api.js'
import type { DocumentData } from '../db/query-builder.js'

type RouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

interface RouteEntry {
  readonly GET?: RouteHandler | undefined
  readonly POST?: RouteHandler | undefined
  readonly PATCH?: RouteHandler | undefined
  readonly DELETE?: RouteHandler | undefined
}

function sendJson (res: ServerResponse, data: Record<string, string | number | boolean | null> | readonly Record<string, string | number | boolean | null>[], statusCode: number = 200): void {
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

function readBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
  })
}

export function createRestRoutes (
  pool: DbPool,
  collections: CollectionRegistry,
  globals: GlobalRegistry
): Map<string, RouteEntry> {
  const api = createLocalApi(pool, collections, globals)
  const routes = new Map<string, RouteEntry>()

  for (const col of collections.getAll()) {
    const slug = col.slug

    routes.set(`/api/${slug}`, {
      GET: async (_req, res) => {
        const result = await api.find({ collection: slug })
        result.match(
          (docs) => sendJson(res, docs as Record<string, string | number | boolean | null>[]),
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      POST: async (req, res) => {
        const body = await readBody(req)
        const data = JSON.parse(body) as DocumentData
        const result = await api.create({ collection: slug, data })
        result.match(
          (doc) => sendJson(res, doc as Record<string, string | number | boolean | null>, 201),
          (err) => sendErrorJson(res, err.message, 400)
        )
      }
    })

    routes.set(`/api/${slug}/:id`, {
      GET: async (req, res) => {
        const id = req.url?.split('/').pop() ?? ''
        const result = await api.findByID({ collection: slug, id })
        result.match(
          (doc) => doc ? sendJson(res, doc as Record<string, string | number | boolean | null>) : sendErrorJson(res, 'Not found', 404),
          (err) => sendErrorJson(res, err.message, 500)
        )
      },
      PATCH: async (req, res) => {
        const id = req.url?.split('/').pop() ?? ''
        const body = await readBody(req)
        const data = JSON.parse(body) as DocumentData
        const result = await api.update({ collection: slug, id, data })
        result.match(
          (doc) => sendJson(res, doc as Record<string, string | number | boolean | null>),
          (err) => sendErrorJson(res, err.message, 400)
        )
      },
      DELETE: async (req, res) => {
        const id = req.url?.split('/').pop() ?? ''
        const result = await api.delete({ collection: slug, id })
        result.match(
          (doc) => sendJson(res, doc as Record<string, string | number | boolean | null>),
          (err) => sendErrorJson(res, err.message, 500)
        )
      }
    })
  }

  return routes
}
