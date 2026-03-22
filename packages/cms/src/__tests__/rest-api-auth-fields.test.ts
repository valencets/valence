import { describe, it, expect, vi, beforeEach } from 'vitest'
import { okAsync } from 'neverthrow'
import { createRestRoutes } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { injectAuthFields } from '../auth/auth-config.js'
import { makeMockPool, asReq, asRes } from './test-helpers.js'
import type { MockIncomingMessage, MockServerResponse } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

vi.mock('../auth/session.js', () => ({
  validateSession: vi.fn()
}))

import { validateSession } from '../auth/session.js'
const mockedValidateSession = vi.mocked(validateSession)

function makeMockReq (method: string, url: string, body: string = ''): IncomingMessage {
  const req: MockIncomingMessage = {
    method,
    url,
    headers: { 'content-type': 'application/json', cookie: 'cms_session=test-session' },
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

function setupWithAuth (poolReturn: readonly Record<string, string | number | null>[] = []) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  const usersCol = injectAuthFields(collection({
    slug: 'users',
    auth: true,
    versions: { drafts: true },
    fields: [
      field.text({ name: 'name', required: true }),
      field.select({
        name: 'role',
        defaultValue: 'editor',
        options: [
          { label: 'Admin', value: 'admin' },
          { label: 'Editor', value: 'editor' }
        ]
      })
    ]
  }))
  collections.register(usersCol)
  collections.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ]
  }))
  return { pool, collections, globals }
}

beforeEach(() => {
  mockedValidateSession.mockReturnValue(okAsync('user-1'))
})

describe('PATCH /api/:collection/:id auth field protection', () => {
  it('rejects role field from PATCH on auth-enabled collections', async () => {
    const updated = { id: 'user-1', name: 'Test', role: 'editor' }
    const { pool, collections, globals } = setupWithAuth([updated])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/users/:id')?.PATCH
    expect(handler).toBeDefined()

    const req = makeMockReq('PATCH', '/api/users/user-1', JSON.stringify({ role: 'admin' }))
    const res = makeMockRes()
    await handler!(req, res, { id: 'user-1' })
    // Should reject — role is a protected field on auth collections
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })

  it('rejects password_hash field from PATCH on auth-enabled collections', async () => {
    const updated = { id: 'user-1', name: 'Test' }
    const { pool, collections, globals } = setupWithAuth([updated])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/users/:id')?.PATCH
    expect(handler).toBeDefined()

    const req = makeMockReq('PATCH', '/api/users/user-1', JSON.stringify({ password_hash: 'evil-hash' }))
    const res = makeMockRes()
    await handler!(req, res, { id: 'user-1' })
    // Should reject — password_hash is a protected field on auth collections
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })

  it('rejects email field from PATCH on auth-enabled collections', async () => {
    const updated = { id: 'user-1', name: 'Test' }
    const { pool, collections, globals } = setupWithAuth([updated])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/users/:id')?.PATCH
    expect(handler).toBeDefined()

    const req = makeMockReq('PATCH', '/api/users/user-1', JSON.stringify({ email: 'hacker@evil.com' }))
    const res = makeMockRes()
    await handler!(req, res, { id: 'user-1' })
    // Should reject — email is a protected field on auth collections
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })

  it('allows non-auth fields in PATCH on auth-enabled collections', async () => {
    const updated = { id: 'user-1', name: 'New Name', role: 'editor' }
    const { pool, collections, globals } = setupWithAuth([updated])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/users/:id')?.PATCH
    expect(handler).toBeDefined()

    const req = makeMockReq('PATCH', '/api/users/user-1', JSON.stringify({ name: 'New Name' }))
    const res = makeMockRes()
    await handler!(req, res, { id: 'user-1' })
    // Should succeed — name is not a protected field
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })

  it('does not reject fields from PATCH on non-auth collections', async () => {
    const updated = { id: 'post-1', title: 'Updated', slug: 'updated' }
    const { pool, collections, globals } = setupWithAuth([updated])
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts/:id')?.PATCH
    expect(handler).toBeDefined()

    const req = makeMockReq('PATCH', '/api/posts/post-1', JSON.stringify({ title: 'Updated' }))
    const res = makeMockRes()
    await handler!(req, res, { id: 'post-1' })
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object))
  })
})

describe('POST /api/:collection auth field protection', () => {
  it('rejects role field from POST on auth-enabled collections', async () => {
    const { pool, collections, globals } = setupWithAuth()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/users')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/users', JSON.stringify({
      name: 'Hacker',
      email: 'hacker@test.com',
      password_hash: 'hash123',
      role: 'admin'
    }))
    const res = makeMockRes()
    await handler!(req, res, {})
    // Should reject — role is a protected field on auth collections
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })

  it('rejects role field from POST with ?draft=true on auth-enabled collections', async () => {
    const { pool, collections, globals } = setupWithAuth()
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/users')?.POST
    expect(handler).toBeDefined()

    const req = makeMockReq('POST', '/api/users?draft=true', JSON.stringify({
      name: 'Hacker',
      role: 'admin'
    }))
    const res = makeMockRes()
    await handler!(req, res, {})
    // Should reject — draft mode must not bypass auth field protection
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })
})
