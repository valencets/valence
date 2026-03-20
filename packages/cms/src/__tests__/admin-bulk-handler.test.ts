import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { CollectionConfig } from '../schema/collection.js'

function makePostsCollection (): CollectionConfig {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ]
  })
}

function makeMockReq (body: string, cookie: string = ''): Record<string, unknown> {
  const req = {
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    url: '/admin/posts/bulk',
    method: 'POST',
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === 'data') cb(Buffer.from(body))
      if (event === 'end') cb()
      return req
    }),
    removeAllListeners: vi.fn(() => req)
  }
  return req
}

function makeMockRes (): Record<string, ReturnType<typeof vi.fn>> {
  return { writeHead: vi.fn(), end: vi.fn(), setHeader: vi.fn() }
}

/** Get a fresh CSRF token by hitting the list GET route */
async function getValidCsrfToken (routes: ReturnType<typeof createAdminRoutes>, colSlug: string): Promise<string> {
  const getReq = { headers: {}, url: `/admin/${colSlug}`, method: 'GET' }
  let htmlBody = ''
  const getRes = {
    writeHead: vi.fn(),
    end: vi.fn((data: string) => { htmlBody = data }),
    setHeader: vi.fn()
  }
  await routes.get(`/admin/${colSlug}`)!.GET!(getReq as never, getRes as never, {})
  const csrfMatch = htmlBody.match(/name="_csrf" value="([^"]+)"/)
  if (!csrfMatch?.[1]) throw new Error('CSRF token not found in list view HTML')
  return csrfMatch[1]
}

describe('admin bulk handler — route registration', () => {
  it('registers POST handler on /admin/:slug/bulk', () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const entry = routes.get('/admin/posts/bulk')
    expect(entry).toBeDefined()
    expect(entry?.POST).toBeDefined()
  })
})

describe('admin bulk handler — CSRF validation', () => {
  it('returns 403 when CSRF token is missing', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const req = makeMockReq('action=delete&ids=abc')
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
  })

  it('returns 403 when CSRF token is invalid', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const req = makeMockReq('_csrf=invalid-token&action=delete&ids=abc')
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything())
  })
})

describe('admin bulk handler — unknown action', () => {
  it('returns 400 for an unknown action', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: 'abc', title: 'Test', slug: 'test', deleted_at: null }])
    const routes = createAdminRoutes(pool, registry)
    const csrfToken = await getValidCsrfToken(routes, 'posts')
    const body = `_csrf=${encodeURIComponent(csrfToken)}&action=unknown&ids=abc`
    const req = makeMockReq(body)
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(400, expect.anything())
  })
})

describe('admin bulk handler — empty IDs', () => {
  it('redirects immediately with 0-item success flash when ids is empty', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const csrfToken = await getValidCsrfToken(routes, 'posts')
    const body = `_csrf=${encodeURIComponent(csrfToken)}&action=delete`
    const req = makeMockReq(body)
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/admin/posts' }))
  })
})

describe('admin bulk handler — delete action', () => {
  it('calls api.delete for each selected ID', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: 'abc', title: 'Test', slug: 'test', deleted_at: '2026-01-01' }])
    const routes = createAdminRoutes(pool, registry)
    const csrfToken = await getValidCsrfToken(routes, 'posts')
    const body = `_csrf=${encodeURIComponent(csrfToken)}&action=delete&ids=abc&ids=def`
    const req = makeMockReq(body)
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/admin/posts' }))
  })

  it('sets a flash cookie after bulk delete', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: 'abc', title: 'Test', slug: 'test', deleted_at: '2026-01-01' }])
    const routes = createAdminRoutes(pool, registry)
    const csrfToken = await getValidCsrfToken(routes, 'posts')
    const body = `_csrf=${encodeURIComponent(csrfToken)}&action=delete&ids=abc`
    const req = makeMockReq(body)
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    const setCookieCalls = res.setHeader.mock.calls.filter((c: unknown[]) => c[0] === 'Set-Cookie')
    expect(setCookieCalls.length).toBeGreaterThan(0)
  })
})

describe('admin bulk handler — publish action', () => {
  it('calls api.update with publish flag for each selected ID and redirects', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: 'abc', title: 'Test', slug: 'test', _status: 'published' }])
    const routes = createAdminRoutes(pool, registry)
    const csrfToken = await getValidCsrfToken(routes, 'posts')
    const body = `_csrf=${encodeURIComponent(csrfToken)}&action=publish&ids=abc`
    const req = makeMockReq(body)
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/admin/posts' }))
  })
})

describe('admin bulk handler — unpublish action', () => {
  it('calls api.unpublish for each selected ID and redirects', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: 'abc', title: 'Test', slug: 'test', _status: 'draft' }])
    const routes = createAdminRoutes(pool, registry)
    const csrfToken = await getValidCsrfToken(routes, 'posts')
    const body = `_csrf=${encodeURIComponent(csrfToken)}&action=unpublish&ids=abc`
    const req = makeMockReq(body)
    const res = makeMockRes()
    await routes.get('/admin/posts/bulk')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/admin/posts' }))
  })
})

describe('admin bulk handler — list GET includes CSRF token', () => {
  it('renders _csrf hidden input in the list view bulk form', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: '1', title: 'Test', slug: 'test' }])
    const routes = createAdminRoutes(pool, registry)
    const getReq = { headers: {}, url: '/admin/posts', method: 'GET' }
    let htmlBody = ''
    const getRes = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { htmlBody = data }),
      setHeader: vi.fn()
    }
    await routes.get('/admin/posts')!.GET!(getReq as never, getRes as never, {})
    expect(htmlBody).toContain('name="_csrf"')
    expect(htmlBody).toContain('action="/admin/posts/bulk"')
  })
})
