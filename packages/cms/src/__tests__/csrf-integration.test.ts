import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

function makePostsCollection () {
  return collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ]
  })
}

function makeMockReq (body: string, cookie: string = ''): Record<string, unknown> {
  const req = {
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    url: '/admin/posts/new',
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

describe('admin CSRF protection', () => {
  it('POST rejects request without _csrf token', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/posts/new')?.POST
    const req = makeMockReq('title=Hello&slug=hello')
    const res = makeMockRes()
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(403)
  })

  it('GET renders form with _csrf hidden input', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/posts/new')?.GET
    const req = { headers: {}, url: '/admin/posts/new', method: 'GET' }
    let body = ''
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { body = data }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(body).toContain('name="_csrf"')
    expect(body).toContain('type="hidden"')
  })
})
