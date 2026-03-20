import { describe, it, expect, vi } from 'vitest'
import { createAuthRoutes, resolveDisplayField } from '../auth/auth-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

function makeMockReq (method: string, cookie: string | undefined, body: string = '', encrypted = false): IncomingMessage {
  const req = {
    method,
    url: '',
    headers: { cookie, 'content-type': 'application/json' },
    socket: { encrypted: encrypted || undefined },
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === 'data' && body) cb(Buffer.from(body))
      if (event === 'end') cb()
      return req
    }),
    removeAllListeners: vi.fn(() => req)
  }
  return req as unknown as IncomingMessage
}

function makeMockRes (): ServerResponse & { body: string, setCookie: string | string[] } {
  const res = {
    writeHead: vi.fn((_code: number, headers: Record<string, string | string[]>) => {
      if (headers['Set-Cookie']) res.setCookie = headers['Set-Cookie']
    }),
    end: vi.fn((data?: string) => { res.body = data ?? '' }),
    body: '',
    setCookie: '' as string | string[]
  }
  return res as unknown as ServerResponse & { body: string, setCookie: string | string[] }
}

describe('createAuthRoutes()', () => {
  it('registers login, logout, and me routes', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({ slug: 'users', auth: true, fields: [field.text({ name: 'name' })] }))
    const routes = createAuthRoutes(makeMockPool(), registry)
    expect(routes.has('/api/users/login')).toBe(true)
    expect(routes.has('/api/users/logout')).toBe(true)
    expect(routes.has('/api/users/me')).toBe(true)
  })
})

describe('POST /api/users/login', () => {
  it('returns 400 for missing email/password', async () => {
    const registry = createCollectionRegistry()
    const routes = createAuthRoutes(makeMockPool(), registry)
    const handler = routes.get('/api/users/login')?.POST
    const req = makeMockReq('POST', undefined, JSON.stringify({}))
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.any(Object))
  })
})

describe('POST /api/users/logout', () => {
  it('returns 200 and clears cookie', async () => {
    const registry = createCollectionRegistry()
    const routes = createAuthRoutes(makeMockPool(), registry)
    const handler = routes.get('/api/users/logout')?.POST
    const req = makeMockReq('POST', 'cms_session=sess-1')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({
      'Set-Cookie': expect.arrayContaining([expect.stringContaining('Max-Age=0')])
    }))
  })

  it('omits Secure flag in logout cookie on non-encrypted connection', async () => {
    const registry = createCollectionRegistry()
    const routes = createAuthRoutes(makeMockPool(), registry)
    const handler = routes.get('/api/users/logout')?.POST
    const req = makeMockReq('POST', 'cms_session=sess-1', '', false)
    const res = makeMockRes()
    await handler!(req, res, {})
    const cookieStr = Array.isArray(res.setCookie) ? res.setCookie.join('; ') : res.setCookie
    expect(cookieStr).not.toContain('Secure')
  })

  it('includes Secure flag in logout cookie on encrypted connection', async () => {
    const registry = createCollectionRegistry()
    const routes = createAuthRoutes(makeMockPool(), registry)
    const handler = routes.get('/api/users/logout')?.POST
    const req = makeMockReq('POST', 'cms_session=sess-1', '', true)
    const res = makeMockRes()
    await handler!(req, res, {})
    const cookieStr = Array.isArray(res.setCookie) ? res.setCookie.join('; ') : res.setCookie
    expect(cookieStr).toContain('Secure')
  })
})

describe('POST /api/users/login rate limiting', () => {
  it('returns 429 after exceeding max attempts', async () => {
    const registry = createCollectionRegistry()
    const pool = makeMockPool([])
    const routes = createAuthRoutes(pool, registry)
    const handler = routes.get('/api/users/login')?.POST
    const body = JSON.stringify({ email: 'attacker@test.com', password: 'wrong' })

    for (let i = 0; i < 5; i++) {
      const req = makeMockReq('POST', undefined, body)
      const res = makeMockRes()
      await handler!(req, res, {})
    }

    const req = makeMockReq('POST', undefined, body)
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(429, expect.any(Object))
  })
})

describe('GET /api/users/me', () => {
  it('returns 401 with no session', async () => {
    const registry = createCollectionRegistry()
    const routes = createAuthRoutes(makeMockPool(), registry)
    const handler = routes.get('/api/users/me')?.GET
    const req = makeMockReq('GET', undefined)
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })
})

describe('resolveDisplayField()', () => {
  it('returns the first non-email, non-password_hash text field from an auth collection', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'users',
      auth: true,
      fields: [field.text({ name: 'username' })]
    }))
    expect(resolveDisplayField(registry)).toBe('username')
  })

  it('falls back to email when auth collection has no other text fields', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'users',
      auth: true,
      fields: []
    }))
    expect(resolveDisplayField(registry)).toBe('email')
  })

  it('falls back to email when no auth collections are registered', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'posts',
      auth: false,
      fields: [field.text({ name: 'title' })]
    }))
    expect(resolveDisplayField(registry)).toBe('email')
  })

  it('ignores email and password_hash fields when resolving display field', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'users',
      auth: true,
      fields: [
        field.text({ name: 'email' }),
        field.text({ name: 'password_hash' }),
        field.text({ name: 'display_name' })
      ]
    }))
    expect(resolveDisplayField(registry)).toBe('display_name')
  })

  it('result is always a valid identifier', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'users',
      auth: true,
      fields: [field.text({ name: 'username' })]
    }))
    const result = resolveDisplayField(registry)
    expect(result).toMatch(/^[a-zA-Z][a-zA-Z0-9_-]*$/)
  })
})
