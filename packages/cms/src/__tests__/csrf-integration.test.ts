import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, asReq, asRes } from './test-helpers.js'
import type { MockIncomingMessage, MockServerResponse } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

function makePostsCollection () {
  return collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ]
  })
}

function makeMockReq (body: string, cookie: string = ''): IncomingMessage {
  const req: MockIncomingMessage = {
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
  return asReq(req)
}

function makeMockRes (): ServerResponse & { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn> } {
  const res: MockServerResponse = {
    writeHead: vi.fn(),
    end: vi.fn(),
    setHeader: vi.fn(),
    body: '',
    statusCode: 200
  }
  return asRes<{ writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn> }>(res)
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
    await handler!(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(403)
  })

  it('GET renders form with _csrf hidden input', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/posts/new')?.GET
    const getReq: MockIncomingMessage = { headers: {}, url: '/admin/posts/new', method: 'GET', on: vi.fn(), removeAllListeners: vi.fn() }
    let body = ''
    const getRes: MockServerResponse = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { body = data }),
      setHeader: vi.fn(),
      body: '',
      statusCode: 200
    }
    await handler!(asReq(getReq), asRes(getRes), {})
    expect(body).toContain('name="_csrf"')
    expect(body).toContain('type="hidden"')
  })
})
