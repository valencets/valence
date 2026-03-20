import { graphql } from 'graphql'
import type { GraphQLSchema, ExecutionResult } from 'graphql'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RestRouteEntry, CmsInstance } from '@valencets/cms'
import { generateGraphQLSchema } from './schema-generator.js'

interface JsonErrorResponse {
  readonly errors: ReadonlyArray<{ readonly message: string }>
}

type JsonResponse = ExecutionResult | JsonErrorResponse

function readBody (req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => { chunks.push(chunk) })
    req.on('end', () => { resolve(Buffer.concat(chunks).toString('utf-8')) })
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

    const rawBody = await readBody(req)

    if (rawBody.trim() === '') {
      sendJson(res, 400, { errors: [{ message: 'Request body is required.' }] })
      return
    }

    let parsed: object
    try {
      const value: unknown = JSON.parse(rawBody)
      if (typeof value !== 'object' || value === null) {
        sendJson(res, 400, { errors: [{ message: 'Request body must be a JSON object.' }] })
        return
      }
      parsed = value
    } catch {
      sendJson(res, 400, { errors: [{ message: 'Invalid JSON body.' }] })
      return
    }

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
