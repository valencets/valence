import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRestRoutes } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, makeErrorPool, makeSequentialPool, asReq, asRes } from './test-helpers.js'
import type { MockIncomingMessage, MockServerResponse } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { okAsync } from 'neverthrow'

vi.mock('../auth/session.js', () => ({
  validateSession: vi.fn()
}))

import { validateSession } from '../auth/session.js'

const AUTH_COOKIE = 'cms_session=valid-session-id'

beforeEach(() => {
  vi.mocked(validateSession).mockReturnValue(okAsync('user-1'))
})

function makeMockReq (method: string, url: string, body: string = '', contentType: string = 'application/json'): IncomingMessage {
  const req: MockIncomingMessage = {
    method,
    url,
    headers: contentType ? { 'content-type': contentType, cookie: AUTH_COOKIE } : { cookie: AUTH_COOKIE },
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === 'data' && body) cb(Buffer.from(body))
      if (event === 'end') cb()
      return req
    }),
    removeAllListeners: vi.fn(() => req)
  }
  return asReq(req)
}

function makeMockRes (): ServerResponse & { body: string } {
  const res: MockServerResponse = {
    writeHead: vi.fn(),
    end: vi.fn((data?: string) => { res.body = data ?? '' }),
    body: '',
    statusCode: 200
  }
  return asRes<{ body: string }>(res)
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

function setupVersioned (poolReturn: readonly Record<string, string | number | null>[] = []) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'posts',
    versions: { drafts: true },
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ]
  }))
  return { pool, collections, globals }
}

describe('POST /api/:collection/bulk — route registration', () => {
  it('registers the bulk route for each collection', () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    expect(routes.has('/api/posts/bulk')).toBe(true)
    expect(routes.get('/api/posts/bulk')?.POST).toBeDefined()
  })
})

describe('POST /api/:collection/bulk — content-type validation', () => {
  it('returns 415 when Content-Type is not application/json', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', '{}', 'text/plain')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(415, expect.any(Object))
  })

  it('returns 415 when Content-Type header is absent', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', '{}', '')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(415, expect.any(Object))
  })
})

describe('POST /api/:collection/bulk — input validation', () => {
  it('returns 400 when ids is missing', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete' }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.error).toBeDefined()
  })

  it('returns 400 when ids is an empty array', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete', ids: [] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.error).toBeDefined()
  })

  it('returns 400 for an unknown action', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'freeze', ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.error).toBeDefined()
  })

  it('returns 400 when action is missing', async () => {
    const { pool, collections, globals } = setup()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })
})

describe('POST /api/:collection/bulk — delete action', () => {
  it('returns 200 with results for delete action', async () => {
    const doc = { id: 'id1', title: 'Post 1', slug: 'post-1', deleted_at: '2026-03-20' }
    const { pool, collections, globals } = setup([doc])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete', ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.results).toBeDefined()
    expect(Array.isArray(body.results)).toBe(true)
    expect(body.results).toHaveLength(1)
  })

  it('each result has id and success fields', async () => {
    const doc = { id: 'id1', title: 'Post 1', slug: 'post-1', deleted_at: '2026-03-20' }
    const { pool, collections, globals } = setup([doc])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete', ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    const body = JSON.parse(res.body)
    const result = body.results[0]
    expect(result.id).toBe('id1')
    expect(result.success).toBe(true)
  })

  it('handles multiple ids and returns a result per id', async () => {
    const doc = { id: 'id1', title: 'Post 1', slug: 'post-1', deleted_at: '2026-03-20' }
    const pool = makeSequentialPool([[doc], [doc]])
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
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete', ids: ['id1', 'id2'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    const body = JSON.parse(res.body)
    expect(body.results).toHaveLength(2)
  })

  it('failed operation includes error field in result', async () => {
    const pool = makeErrorPool(new Error('DB failure'))
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
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete', ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.results[0].success).toBe(false)
    expect(body.results[0].error).toBeDefined()
    expect(body.results[0].id).toBe('id1')
  })
})

describe('POST /api/:collection/bulk — publish action', () => {
  it('returns 200 with results for publish action', async () => {
    const doc = { id: 'id1', title: 'Post 1', slug: 'post-1', _status: 'published' }
    const { pool, collections, globals } = setupVersioned([doc])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'publish', ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.results[0].id).toBe('id1')
    expect(body.results[0].success).toBe(true)
  })
})

describe('POST /api/:collection/bulk — unpublish action', () => {
  it('returns 200 with results for unpublish action', async () => {
    const doc = { id: 'id1', title: 'Post 1', slug: 'post-1', _status: 'draft' }
    const { pool, collections, globals } = setupVersioned([doc])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'unpublish', ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.results[0].id).toBe('id1')
    expect(body.results[0].success).toBe(true)
  })
})

describe('POST /api/:collection/bulk — result shape', () => {
  it('successful result includes doc field', async () => {
    const doc = { id: 'id1', title: 'Post 1', slug: 'post-1', deleted_at: '2026-03-20' }
    const { pool, collections, globals } = setup([doc])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete', ids: ['id1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    const body = JSON.parse(res.body)
    const result = body.results[0]
    expect(result.success).toBe(true)
    expect(result.doc).toBeDefined()
  })
})
