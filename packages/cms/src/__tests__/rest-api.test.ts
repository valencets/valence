import { describe, it, expect, vi } from 'vitest'
import { createRestRoutes } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import type { DbPool } from '@valencets/db'
import type { IncomingMessage, ServerResponse } from 'node:http'

function makeMockPool (returnValue: readonly Record<string, string | number | null>[] = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

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
