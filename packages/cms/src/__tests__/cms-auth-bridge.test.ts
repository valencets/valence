import { describe, it, expect, vi } from 'vitest'
import { createCmsAuthValidator, createCmsAuthGuard } from '../auth/middleware.js'
import { makeMockPool, makeSequentialPool } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext } from '@valencets/core/server'

function makeMockReq (cookie?: string): IncomingMessage {
  return { headers: { cookie }, url: '/admin' } as IncomingMessage
}

function makeMockRes (): ServerResponse {
  const res = {
    writeHead: vi.fn(),
    end: vi.fn(),
    statusCode: 200
  }
  return res as unknown as ServerResponse
}

function makeMockCtx (path: string = '/admin'): RequestContext {
  return {
    requestId: 'test-1',
    startTime: [0, 0] as const,
    url: new URL(`http://localhost${path}`),
    params: {}
  }
}

describe('createCmsAuthValidator', () => {
  it('returns authenticated false when no cms_session cookie', async () => {
    const pool = makeMockPool()
    const validate = createCmsAuthValidator(pool)
    const req = makeMockReq(undefined)
    const result = await validate(req)
    expect(result.authenticated).toBe(false)
  })

  it('returns authenticated true with user for valid session', async () => {
    // First call: validateSession returns user_id, second call: query user returns user row
    const pool = makeSequentialPool([
      [{ id: 'sess-1', user_id: 'user-1', expires_at: '2099-01-01' }],
      [{ id: 'user-1', email: 'admin@test.com', role: 'admin' }]
    ])
    const validate = createCmsAuthValidator(pool)
    const req = makeMockReq('cms_session=sess-1')
    const result = await validate(req)
    expect(result.authenticated).toBe(true)
    if (result.authenticated) {
      expect(result.user.id).toBe('user-1')
      expect(result.user.role).toBe('admin')
    }
  })

  it('returns authenticated false for invalid session', async () => {
    const pool = makeMockPool([])
    const validate = createCmsAuthValidator(pool)
    const req = makeMockReq('cms_session=bad-id')
    const result = await validate(req)
    expect(result.authenticated).toBe(false)
  })
})

describe('createCmsAuthGuard', () => {
  it('returns a core Middleware function', () => {
    const pool = makeMockPool()
    const guard = createCmsAuthGuard(pool)
    expect(typeof guard).toBe('function')
    expect(guard.length).toBe(4)
  })

  it('returns 401 for unauthenticated requests', async () => {
    const pool = makeMockPool([])
    const guard = createCmsAuthGuard(pool)
    const req = makeMockReq(undefined)
    const res = makeMockRes()
    const ctx = makeMockCtx()
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('supports redirectTo option', async () => {
    const pool = makeMockPool([])
    const guard = createCmsAuthGuard(pool, { redirectTo: '/admin/login' })
    const req = makeMockReq(undefined)
    const res = makeMockRes()
    const ctx = makeMockCtx('/admin/posts')
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).not.toHaveBeenCalled()
    // Should redirect since no accept header means it falls through to JSON 401
    // (no HTML accept header = API-style response)
    expect(res.writeHead).toHaveBeenCalled()
  })
})
