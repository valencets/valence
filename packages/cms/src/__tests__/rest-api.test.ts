import { describe, it, expect, vi } from 'vitest'
import { createRestRoutes } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, makeSequentialPool } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { PaginatedResult } from '../db/query-types.js'
import type { DocumentRow } from '../db/query-builder.js'

function makeMockReq (method: string, url: string, body: string = ''): IncomingMessage {
  const req = {
    method,
    url,
    headers: { 'content-type': 'application/json' },
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === 'data' && body) cb(Buffer.from(body))
      if (event === 'end') cb()
      return req
    }),
    removeAllListeners: vi.fn(() => req)
  }
  return req as unknown as IncomingMessage
}

function makeMockRes (): ServerResponse & { body: string } {
  const res = {
    writeHead: vi.fn(),
    end: vi.fn((data?: string) => { res.body = data ?? '' }),
    body: '',
    statusCode: 200
  }
  return res as unknown as ServerResponse & { body: string }
}

function setup (poolReturn: readonly Record<string, string | number | null>[] = []) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ]
  }))
  return { pool, collections, globals }
}

describe('createRestRoutes()', () => {
  it('returns a route map with collection endpoints', () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    expect(routes.has('/api/posts')).toBe(true)
    expect(routes.has('/api/posts/:id')).toBe(true)
  })
})

describe('GET /api/:collection', () => {
  it('returns JSON array of documents', async () => {
    const rows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const { pool, collections, globals } = setup(rows)
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })
})

describe('POST /api/:collection', () => {
  it('creates a document and returns it', async () => {
    const inserted = { id: 'new-1', title: 'New', slug: 'new' }
    const { pool, collections, globals } = setup([inserted])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts', JSON.stringify({ title: 'New', slug: 'new' }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object))
  })
})

describe('GET /api/:collection query params', () => {
  it('passes search param to find()', async () => {
    const rows = [{ id: '1', title: 'Hello World', slug: 'hello-world' }]
    const { pool, collections, globals } = setup(rows)
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?search=hello')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body) as DocumentRow[]
    expect(Array.isArray(body)).toBe(true)
  })

  it('passes sort and dir params as orderBy to find()', async () => {
    const rows = [{ id: '1', title: 'A', slug: 'a' }, { id: '2', title: 'B', slug: 'b' }]
    const { pool, collections, globals } = setup(rows)
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?sort=title&dir=asc')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body) as DocumentRow[]
    expect(Array.isArray(body)).toBe(true)
  })

  it('passes page and limit params to find() and returns PaginatedResult envelope', async () => {
    const dataRows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const countRows = [{ count: '1' }]
    const pool = makeSequentialPool([countRows, dataRows])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true })
      ]
    }))
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?page=2&limit=25')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body) as PaginatedResult<DocumentRow>
    expect(body).toHaveProperty('docs')
    expect(body).toHaveProperty('totalDocs')
    expect(body).toHaveProperty('page')
    expect(body).toHaveProperty('totalPages')
  })

  it('passes field filter params as where clause to find()', async () => {
    const rows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const { pool, collections, globals } = setup(rows)
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?title=Hello')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body) as DocumentRow[]
    expect(Array.isArray(body)).toBe(true)
  })

  it('returns flat array when no ?page= present (backwards compatible)', async () => {
    const rows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const { pool, collections, globals } = setup(rows)
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?search=hello')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(Array.isArray(body)).toBe(true)
    expect(body).not.toHaveProperty('docs')
  })

  it('rejects invalid sort field name (not in collection schema)', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?sort=; DROP TABLE posts; --')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })

  it('rejects invalid filter field name (not in collection schema)', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?badfield=value')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })

  it('allows system column sort fields (id, created_at, updated_at)', async () => {
    const rows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const { pool, collections, globals } = setup(rows)
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts?sort=created_at&dir=desc')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })
})
