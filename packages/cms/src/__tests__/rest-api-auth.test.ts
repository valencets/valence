import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRestRoutes } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, asReq, asRes } from './test-helpers.js'
import type { MockIncomingMessage, MockServerResponse } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

vi.mock('../auth/session.js', () => ({
  validateSession: vi.fn()
}))

import { validateSession } from '../auth/session.js'

const mockedValidateSession = vi.mocked(validateSession)

function makeMockReq (method: string, url: string, body: string = '', cookie: string = ''): IncomingMessage {
  const req: MockIncomingMessage = {
    method,
    url,
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie } : {})
    },
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

function setupNoAccess (poolReturn: readonly Record<string, string | number | null>[] = []) {
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

function setupWithAccess (
  accessConfig: {
    readonly create?: ((args: { readonly req?: { readonly headers: Record<string, string> } }) => boolean) | undefined
    readonly read?: ((args: { readonly req?: { readonly headers: Record<string, string> } }) => boolean) | undefined
    readonly update?: ((args: { readonly req?: { readonly headers: Record<string, string> } }) => boolean) | undefined
    readonly delete?: ((args: { readonly req?: { readonly headers: Record<string, string> } }) => boolean) | undefined
  },
  poolReturn: readonly Record<string, string | number | null>[] = []
) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'articles',
    fields: [
      field.text({ name: 'title', required: true })
    ],
    access: accessConfig
  }))
  return { pool, collections, globals }
}

function mockValidSession (userId: string = 'user-1'): void {
  const { okAsync } = require('@valencets/resultkit') as typeof import('@valencets/resultkit')
  mockedValidateSession.mockReturnValue(okAsync(userId))
}

function mockInvalidSession (): void {
  const { errAsync } = require('@valencets/resultkit') as typeof import('@valencets/resultkit')
  mockedValidateSession.mockReturnValue(errAsync({
    code: 'NOT_FOUND' as const,
    message: 'Session not found or expired'
  }))
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('REST API Authentication — default policy (no access config)', () => {
  it('returns 401 for unauthenticated GET list', async () => {
    const { pool, collections, globals } = setupNoAccess([{ id: '1', title: 'Hello', slug: 'hello' }])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
    const body = JSON.parse(res.body)
    expect(body.error).toBe('Unauthorized')
  })

  it('returns 401 for unauthenticated POST create', async () => {
    const { pool, collections, globals } = setupNoAccess()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts', JSON.stringify({ title: 'New', slug: 'new' }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 401 for unauthenticated GET by ID', async () => {
    const { pool, collections, globals } = setupNoAccess([{ id: 'abc', title: 'Found', slug: 'found' }])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/:id')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts/abc')
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 401 for unauthenticated PATCH update', async () => {
    const { pool, collections, globals } = setupNoAccess()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/:id')?.PATCH
    expect(handler).toBeDefined()

    const req = makeMockReq('PATCH', '/api/posts/abc', JSON.stringify({ title: 'Updated' }))
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 401 for unauthenticated DELETE', async () => {
    const { pool, collections, globals } = setupNoAccess()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/:id')?.DELETE
    expect(handler).toBeDefined()

    const req = makeMockReq('DELETE', '/api/posts/abc')
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 401 for unauthenticated unpublish', async () => {
    const { pool, collections, globals } = setupNoAccess()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/:id/unpublish')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/abc/unpublish')
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 401 for unauthenticated bulk operation', async () => {
    const { pool, collections, globals } = setupNoAccess()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/bulk')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts/bulk', JSON.stringify({ action: 'delete', ids: ['1'] }))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 200 for authenticated GET list', async () => {
    mockValidSession()
    const rows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const { pool, collections, globals } = setupNoAccess(rows)
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts', '', 'cms_session=valid-session-id')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })

  it('returns 201 for authenticated POST create', async () => {
    mockValidSession()
    const inserted = { id: 'new-1', title: 'New', slug: 'new' }
    const { pool, collections, globals } = setupNoAccess([inserted])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/posts', JSON.stringify({ title: 'New', slug: 'new' }), 'cms_session=valid-session-id')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(201, expect.any(Object))
  })

  it('returns 200 for authenticated DELETE', async () => {
    mockValidSession()
    const deleted = { id: 'abc', title: 'Gone', slug: 'gone', deleted_at: '2026-03-19' }
    const { pool, collections, globals } = setupNoAccess([deleted])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/:id')?.DELETE
    expect(handler).toBeDefined()

    const req = makeMockReq('DELETE', '/api/posts/abc', '', 'cms_session=valid-session-id')
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })

  it('returns 401 for expired/invalid session cookie', async () => {
    mockInvalidSession()
    const { pool, collections, globals } = setupNoAccess()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/posts', '', 'cms_session=expired-session-id')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })
})

describe('REST API Access Control — custom access config', () => {
  it('allows unauthenticated GET when read access returns true', async () => {
    const rows = [{ id: '1', title: 'Public' }]
    const { pool, collections, globals } = setupWithAccess(
      { read: () => true },
      rows
    )
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/articles')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/articles')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })

  it('blocks unauthenticated POST when create access returns false', async () => {
    const { pool, collections, globals } = setupWithAccess(
      { read: () => true, create: () => false }
    )
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/articles')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/articles', JSON.stringify({ title: 'Nope' }))
    const res = makeMockRes()
    await handler!(req, res, {})
    // No user, access returned false → 401
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 403 for authenticated user when access returns false', async () => {
    mockValidSession()
    const { pool, collections, globals } = setupWithAccess(
      { create: () => false }
    )
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/articles')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/articles', JSON.stringify({ title: 'Forbidden' }), 'cms_session=valid-session-id')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object))
  })

  it('allows unauthenticated GET by ID when read access returns true', async () => {
    const rows = [{ id: 'abc', title: 'Public Doc' }]
    const { pool, collections, globals } = setupWithAccess(
      { read: () => true },
      rows
    )
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/articles/:id')?.GET
    expect(handler).toBeDefined()

    const req = makeMockReq('GET', '/api/articles/abc')
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })

  it('applies update access to unpublish route', async () => {
    const { pool, collections, globals } = setupWithAccess(
      { update: () => false }
    )
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/articles/:id/unpublish')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/articles/abc/unpublish')
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('applies delete access to bulk delete', async () => {
    const { pool, collections, globals } = setupWithAccess(
      { delete: () => false }
    )
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/articles/bulk')?.POST
    expect(handler).toBeDefined()

    const body = JSON.stringify({ action: 'delete', ids: ['1'] })
    const req = makeMockReq('POST', '/api/articles/bulk', body)
    const res = makeMockRes()
    await handler!(req, res, {})
    // No user + access returns false → 401
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('applies update access to bulk publish', async () => {
    mockValidSession()
    const { pool, collections, globals } = setupWithAccess(
      { update: () => false }
    )
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/articles/bulk')?.POST
    expect(handler).toBeDefined()

    const body = JSON.stringify({ action: 'publish', ids: ['1'] })
    const req = makeMockReq('POST', '/api/articles/bulk', body, 'cms_session=valid-session-id')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.any(Object))
  })
})
