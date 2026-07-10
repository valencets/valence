import { fromThrowable } from '@valencets/resultkit'
import { graphql } from 'graphql'
import type { GraphQLSchema, ExecutionResult } from 'graphql'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RestRouteEntry, CmsInstance } from '@valencets/cms'
import { generateGraphQLSchema } from './schema-generator.js'

interface JsonErrorResponse {
  readonly errors: ReadonlyArray<{ readonly message: string }>
}

type JsonResponse = ExecutionResult | JsonErrorResponse

// #350 audit — GraphQL documents are small; anything past this is hostile.
// At the cap the read settles immediately so nothing buffers an
// attacker's unbounded stream.
const MAX_BODY_BYTES = 256 * 1024

interface BodyRead {
  readonly body: string
  readonly tooLarge: boolean
}

function readBody (req: IncomingMessage): Promise<BodyRead> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let total = 0
    let settled = false
    const settle = (result: BodyRead): void => {
      if (settled) return
      settled = true
      resolve(result)
    }
    req.on('data', (chunk: Buffer) => {
      if (settled) return
      total += chunk.length
      if (total > MAX_BODY_BYTES) {
        chunks.length = 0
        settle({ body: '', tooLarge: true })
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => { settle({ body: Buffer.concat(chunks).toString('utf-8'), tooLarge: false }) })
    req.on('error', reject)
  })
}

interface GraphQLRequestBody {
  readonly query: string
  readonly variables?: Record<string, string | number | boolean | null> | undefined
  readonly operationName?: string | undefined
}

function isGraphQLRequestBody (value: object): value is GraphQLRequestBody {
  const obj = value as { query?: unknown }
  return typeof obj.query === 'string'
}

function sendJson (res: ServerResponse, status: number, data: JsonResponse): void {
  const body = JSON.stringify(data)
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(body)
}

export function createGraphQLHandler (schema: GraphQLSchema): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'POST') {
      sendJson(res, 405, { errors: [{ message: 'Method not allowed. Use POST.' }] })
      return
    }

    const bodyRead = await readBody(req)

    if (bodyRead.tooLarge) {
      sendJson(res, 413, { errors: [{ message: 'Request body too large.' }] })
      return
    }

    const rawBody = bodyRead.body

    if (rawBody.trim() === '') {
      sendJson(res, 400, { errors: [{ message: 'Request body is required.' }] })
      return
    }

    const safeJsonParse = fromThrowable(JSON.parse, () => null)
    const parseResult = safeJsonParse(rawBody)
    if (parseResult.isErr() || parseResult.value === null) {
      sendJson(res, 400, { errors: [{ message: 'Invalid JSON body.' }] })
      return
    }
    if (typeof parseResult.value !== 'object') {
      sendJson(res, 400, { errors: [{ message: 'Request body must be a JSON object.' }] })
      return
    }
    const parsed: object = parseResult.value as object

    if (!isGraphQLRequestBody(parsed)) {
      sendJson(res, 400, { errors: [{ message: 'Missing required field: query.' }] })
      return
    }

    const result = await graphql({
      schema,
      source: parsed.query,
      variableValues: parsed.variables,
      operationName: parsed.operationName
    })

    sendJson(res, 200, result)
  }
}

export function createGraphQLRoutes (cms: CmsInstance): Map<string, RestRouteEntry> {
  const schema = generateGraphQLSchema(cms.collections.getAll(), cms.api)
  const handler = createGraphQLHandler(schema)

  const routeEntry: RestRouteEntry = {
    POST: async (req, res, _params) => {
      await handler(req, res)
    }
  }

  const routes = new Map<string, RestRouteEntry>()
  routes.set('/graphql', routeEntry)
  return routes
}
