import { describe, it, expect, vi } from 'vitest'
import { createRestRoutes } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

interface MockReq {
  method: string
  url: string
  headers: Record<string, string>
  on: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
}

interface MockRes {
  writeHead: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  body: string
  statusCode: number
}

interface MockSql {
  unsafe: ReturnType<typeof vi.fn> & { mock: { calls: readonly (readonly string[])[] } }
}

function makeMockReq (method: string, url: string, body: string = ''): IncomingMessage {
  const req: MockReq = {
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
  return req as IncomingMessage
}

function makeMockRes (): ServerResponse & { body: string } {
  const res: MockRes = {
    writeHead: vi.fn(),
    end: vi.fn((data?: string) => { res.body = data ?? '' }),
    body: '',
    statusCode: 200
  }
  return res as ServerResponse & { body: string }
}

function setupVersioned (poolReturn: readonly Record<string, string | number | null>[] = []) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true })
    ],
    versions: { drafts: true }
  }))
  return { pool, collections, globals }
}

describe('REST API draft query param', () => {
  describe('GET /api/posts', () => {
    it('passes includeDrafts: false by default', async () => {
      const rows = [{ id: '1', title: 'Test', _status: 'published' }]
      const { pool, collections, globals } = setupVersioned(rows)
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts')?.GET
      expect(handler).toBeDefined()

      const req = makeMockReq('GET', '/api/posts')
      const res = makeMockRes()
      await handler!(req, res, {})

      // The query builder should add _status = 'published' filter
      const calls = (pool.sql as MockSql).unsafe.mock.calls
      const sql = calls.map((c) => c[0]).join(' ')
      expect(sql).toContain('published')
    })

    it('passes includeDrafts: true when ?draft=true', async () => {
      const rows = [{ id: '1', title: 'Test', _status: 'draft' }]
      const { pool, collections, globals } = setupVersioned(rows)
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts')?.GET
      expect(handler).toBeDefined()

      const req = makeMockReq('GET', '/api/posts?draft=true')
      const res = makeMockRes()
      await handler!(req, res, {})

      // Should NOT filter by _status = 'published' when includeDrafts
      const calls = (pool.sql as MockSql).unsafe.mock.calls
      const allSql = calls.map((c) => c[0]).join(' ')
      expect(allSql).not.toContain("= 'published'")
    })

    it('does not reject draft as invalid filter field', async () => {
      const rows = [{ id: '1', title: 'Test', _status: 'published' }]
      const { pool, collections, globals } = setupVersioned(rows)
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts')?.GET
      expect(handler).toBeDefined()

      const req = makeMockReq('GET', '/api/posts?draft=true')
      const res = makeMockRes()
      await handler!(req, res, {})

      // Should not return 400 error for draft param
      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    })
  })

  describe('POST /api/posts', () => {
    it('creates as draft when ?draft=true', async () => {
      const inserted = { id: '1', title: 'Draft Post', _status: 'draft' }
      const { pool, collections, globals } = setupVersioned([inserted])
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts')?.POST
      expect(handler).toBeDefined()

      const req = makeMockReq('POST', '/api/posts?draft=true', JSON.stringify({ title: 'Draft Post' }))
      const res = makeMockRes()
      await handler!(req, res, {})

      // Should pass draft data with _status = 'draft' to insert
      const calls = (pool.sql as MockSql).unsafe.mock.calls
      const insertCall = calls.find((c) => c[0]?.includes('INSERT'))
      expect(insertCall).toBeDefined()
      expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object))
    })

    it('creates as published by default', async () => {
      const inserted = { id: '1', title: 'Published', _status: 'published' }
      const { pool, collections, globals } = setupVersioned([inserted])
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts')?.POST
      expect(handler).toBeDefined()

      const req = makeMockReq('POST', '/api/posts', JSON.stringify({ title: 'Published' }))
      const res = makeMockRes()
      await handler!(req, res, {})

      expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object))
    })

    it('validates with draft schema when ?draft=true', async () => {
      const inserted = { id: '1', title: '', _status: 'draft' }
      const { pool, collections, globals } = setupVersioned([inserted])
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts')?.POST
      expect(handler).toBeDefined()

      // Empty object should pass draft validation (all fields optional)
      const req = makeMockReq('POST', '/api/posts?draft=true', JSON.stringify({}))
      const res = makeMockRes()
      await handler!(req, res, {})

      expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object))
    })
  })

  describe('PATCH /api/posts/:id', () => {
    it('saves as draft when ?draft=true', async () => {
      const updated = { id: '1', title: 'Updated Draft', _status: 'draft' }
      const { pool, collections, globals } = setupVersioned([updated])
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts/:id')?.PATCH
      expect(handler).toBeDefined()

      const req = makeMockReq('PATCH', '/api/posts/1?draft=true', JSON.stringify({ title: 'Updated Draft' }))
      const res = makeMockRes()
      await handler!(req, res, { id: '1' })

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    })

    it('publishes when ?publish=true', async () => {
      const updated = { id: '1', title: 'Now Published', _status: 'published' }
      const { pool, collections, globals } = setupVersioned([updated])
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts/:id')?.PATCH
      expect(handler).toBeDefined()

      const req = makeMockReq('PATCH', '/api/posts/1?publish=true', JSON.stringify({ title: 'Now Published' }))
      const res = makeMockRes()
      await handler!(req, res, { id: '1' })

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    })
  })

  describe('POST /api/posts/:id/unpublish', () => {
    it('registers the unpublish route', () => {
      const { pool, collections, globals } = setupVersioned()
      const routes = createRestRoutes(pool, collections, globals)
      expect(routes.has('/api/posts/:id/unpublish')).toBe(true)
      expect(routes.get('/api/posts/:id/unpublish')?.POST).toBeDefined()
    })

    it('calls unpublish and returns the document', async () => {
      const doc = { id: '1', title: 'Unpublished', _status: 'draft' }
      const { pool, collections, globals } = setupVersioned([doc])
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts/:id/unpublish')?.POST
      expect(handler).toBeDefined()

      const req = makeMockReq('POST', '/api/posts/1/unpublish')
      const res = makeMockRes()
      await handler!(req, res, { id: '1' })

      expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
      const body = JSON.parse(res.body)
      expect(body._status).toBe('draft')
    })

    it('returns 400 when ID is missing', async () => {
      const { pool, collections, globals } = setupVersioned()
      const routes = createRestRoutes(pool, collections, globals)
      const handler = routes.get('/api/posts/:id/unpublish')?.POST
      expect(handler).toBeDefined()

      const req = makeMockReq('POST', '/api/posts//unpublish')
      const res = makeMockRes()
      await handler!(req, res, { id: '' })

      expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
    })
  })
})
