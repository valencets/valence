import { describe, it, expect, vi } from 'vitest'
import { hasRole, DefaultRoleHierarchy, createAuthGuard } from '../auth-guard.js'
import type { AuthResult } from '../auth-guard.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext } from '../middleware-types.js'

function makeMockReq (headers?: Record<string, string>): IncomingMessage {
  return { headers: headers ?? {}, url: '/admin' } as IncomingMessage
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

describe('hasRole', () => {
  it('returns true when user role outranks required role', () => {
    expect(hasRole('admin', 'editor', DefaultRoleHierarchy)).toBe(true)
  })

  it('returns false when user role is below required role', () => {
    expect(hasRole('editor', 'admin', DefaultRoleHierarchy)).toBe(false)
  })

  it('returns true when user role equals required role', () => {
    expect(hasRole('editor', 'editor', DefaultRoleHierarchy)).toBe(true)
  })

  it('returns false when user role is unknown', () => {
    expect(hasRole('unknown', 'admin', DefaultRoleHierarchy)).toBe(false)
  })

  it('supports custom hierarchy', () => {
    const custom = { editor: 1, admin: 2, superadmin: 3 } as const
    expect(hasRole('superadmin', 'admin', custom)).toBe(true)
  })
})

describe('createAuthGuard — API routes', () => {
  it('returns 401 JSON when unauthenticated', async () => {
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: false })
    const guard = createAuthGuard({ validate })
    const req = makeMockReq()
    const res = makeMockRes()
    const ctx = makeMockCtx()
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.objectContaining({ 'Content-Type': 'application/json; charset=utf-8' }))
  })

  it('calls next when authenticated', async () => {
    const user = { id: 'u-1', role: 'admin' }
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: true, user })
    const guard = createAuthGuard({ validate })
    const req = makeMockReq()
    const res = makeMockRes()
    const ctx = makeMockCtx()
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).toHaveBeenCalled()
    expect(res.writeHead).not.toHaveBeenCalled()
  })

  it('populates ctx.user after auth guard runs', async () => {
    const user = { id: 'u-1', role: 'admin' }
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: true, user })
    const guard = createAuthGuard({ validate })
    const req = makeMockReq()
    const res = makeMockRes()
    const ctx = makeMockCtx()
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect((ctx as RequestContext & { user: typeof user }).user).toEqual(user)
  })

  it('returns 403 JSON when role is insufficient', async () => {
    const user = { id: 'u-1', role: 'editor' }
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: true, user })
    const guard = createAuthGuard({ validate, role: 'admin' })
    const req = makeMockReq()
    const res = makeMockRes()
    const ctx = makeMockCtx()
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.objectContaining({ 'Content-Type': 'application/json; charset=utf-8' }))
  })

  it('passes when no role option and user is authenticated', async () => {
    const user = { id: 'u-1', role: 'editor' }
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: true, user })
    const guard = createAuthGuard({ validate })
    const req = makeMockReq()
    const res = makeMockRes()
    const ctx = makeMockCtx()
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).toHaveBeenCalled()
  })
})

describe('createAuthGuard — HTML redirect flow', () => {
  it('redirects unauthenticated HTML request to login with returnTo', async () => {
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: false })
    const guard = createAuthGuard({ validate, redirectTo: '/login' })
    const req = makeMockReq({ accept: 'text/html' })
    const res = makeMockRes()
    const ctx = makeMockCtx('/admin/posts')
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
      Location: '/login?returnTo=/admin/posts'
    }))
  })

  it('validates returnTo via safeRedirect', async () => {
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: false })
    const guard = createAuthGuard({ validate, redirectTo: '/login' })
    const req = makeMockReq({ accept: 'text/html' })
    const res = makeMockRes()
    // Use a dangerous path that safeRedirect would reject
    const ctx = makeMockCtx('//evil.com')
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({
      Location: '/login?returnTo=/'
    }))
  })

  it('sends 401 with X-Valence-Redirect for fragment requests', async () => {
    const validate = vi.fn<() => Promise<AuthResult>>().mockResolvedValue({ authenticated: false })
    const guard = createAuthGuard({ validate, redirectTo: '/login' })
    const req = makeMockReq({ 'x-valence-fragment': '1' })
    const res = makeMockRes()
    const ctx = makeMockCtx('/admin/posts')
    const next = vi.fn()

    await guard(req, res, ctx, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.objectContaining({
      'X-Valence-Redirect': '/login?returnTo=/admin/posts'
    }))
  })
})
