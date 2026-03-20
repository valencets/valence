import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql'
import { createGraphQLHandler } from '../handler.js'

// --- Mock HTTP helpers ---

function makeRequest (
  method: string,
  body: string | null = null
): IncomingMessage {
  const emitter = new EventEmitter() as IncomingMessage
  emitter.method = method
  emitter.headers = {}
  emitter.url = '/graphql'

  // Defer emitting data so handlers can register listeners first
  if (body !== null) {
    const bodyStr = body
    setTimeout(() => {
      emitter.emit('data', Buffer.from(bodyStr))
      emitter.emit('end')
    }, 0)
  } else {
    setTimeout(() => {
      emitter.emit('end')
    }, 0)
  }

  return emitter
}

interface ResponseCapture {
  status: number | undefined
  headers: Record<string, string>
  body: string
}

function makeResponse (): { res: ServerResponse; capture: ResponseCapture } {
  const capture: ResponseCapture = {
    status: undefined,
    headers: {},
    body: ''
  }

  const chunks: Buffer[] = []

  const res = {
    writeHead: vi.fn((status: number, headers?: Record<string, string>) => {
      capture.status = status
      if (headers) {
        Object.assign(capture.headers, headers)
      }
    }),
    end: vi.fn((data?: string | Buffer) => {
      if (data !== undefined) {
        chunks.push(typeof data === 'string' ? Buffer.from(data) : data)
      }
      capture.body = Buffer.concat(chunks).toString('utf-8')
    }),
    setHeader: vi.fn((name: string, value: string) => {
      capture.headers[name] = value
    })
  } as unknown as ServerResponse

  return { res, capture }
}

// --- Simple test schema ---

function makeSimpleSchema (): GraphQLSchema {
  return new GraphQLSchema({
    query: new GraphQLObjectType({
      name: 'Query',
      fields: {
        hello: {
          type: GraphQLString,
          resolve: () => 'world'
        },
        greet: {
          type: GraphQLString,
          args: {
            name: { type: GraphQLString }
          },
          resolve: (_source, args: { name?: string }) => `Hello, ${args.name ?? 'stranger'}!`
        }
      }
    })
  })
}

// --- Handler tests ---

describe('createGraphQLHandler', () => {
  describe('method validation', () => {
    it('returns 405 for GET requests', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('GET')
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(405)
    })

    it('returns 405 for DELETE requests', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('DELETE')
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(405)
    })

    it('returns 405 for PUT requests', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('PUT')
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(405)
    })

    it('returns 405 for PATCH requests', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('PATCH')
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(405)
    })
  })

  describe('JSON body parsing', () => {
    it('returns 400 for non-JSON body', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', 'not valid json')
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(400)
    })

    it('returns 400 for missing query field', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', JSON.stringify({ variables: {} }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(400)
    })

    it('returns 400 for empty body', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', '')
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(400)
    })
  })

  describe('successful execution', () => {
    it('executes a basic query and returns data', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', JSON.stringify({ query: '{ hello }' }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(200)
      const body = JSON.parse(capture.body)
      expect(body.data?.hello).toBe('world')
    })

    it('passes variables through to the resolver', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', JSON.stringify({
        query: 'query Greet($name: String) { greet(name: $name) }',
        variables: { name: 'Alice' }
      }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(200)
      const body = JSON.parse(capture.body)
      expect(body.data?.greet).toBe('Hello, Alice!')
    })

    it('returns errors array for invalid GraphQL query', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', JSON.stringify({ query: '{ unknownField }' }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      const body = JSON.parse(capture.body)
      expect(body.errors).toBeDefined()
      expect(Array.isArray(body.errors)).toBe(true)
      expect(body.errors.length).toBeGreaterThan(0)
    })

    it('sets Content-Type: application/json header', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', JSON.stringify({ query: '{ hello }' }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.headers['Content-Type']).toBe('application/json')
    })

    it('responds to introspection query with schema data', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const introspectionQuery = `{
        __schema {
          queryType {
            name
          }
        }
      }`
      const req = makeRequest('POST', JSON.stringify({ query: introspectionQuery }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(200)
      const body = JSON.parse(capture.body)
      expect(body.data?.__schema?.queryType?.name).toBe('Query')
    })

    it('returns 200 for valid query even with no data', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', JSON.stringify({ query: '{ hello }' }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(200)
    })
  })

  describe('operationName', () => {
    it('passes operationName to graphql execution', async () => {
      const schema = makeSimpleSchema()
      const handler = createGraphQLHandler(schema)
      const req = makeRequest('POST', JSON.stringify({
        query: 'query Hello { hello }',
        operationName: 'Hello'
      }))
      const { res, capture } = makeResponse()

      await handler(req, res)

      expect(capture.status).toBe(200)
      const body = JSON.parse(capture.body)
      expect(body.data?.hello).toBe('world')
    })
  })
})
