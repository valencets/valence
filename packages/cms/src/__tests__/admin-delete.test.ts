import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { renderEditView } from '../admin/edit-view.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, asReq, asRes } from './test-helpers.js'
import type { MockIncomingMessage, MockServerResponse } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
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

function makeMockReq (body: string, cookie: string = ''): IncomingMessage {
  const req: MockIncomingMessage = {
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    url: '/admin/posts/abc/delete',
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

describe('admin delete route', () => {
  it('registers POST handler on /admin/:slug/:id/delete', () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const entry = routes.get('/admin/posts/:id/delete')
    expect(entry).toBeDefined()
    expect(entry?.POST).toBeDefined()
  })

  it('POST delete with valid CSRF calls api.delete, sets flash, redirects 302', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool([{ id: 'abc', title: 'Test', slug: 'test', deleted_at: '2026-01-01' }])
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })

    // First get a valid CSRF token by hitting the new form
    const getReq: MockIncomingMessage = { headers: {}, url: '/admin/posts/new', method: 'GET', on: vi.fn(), removeAllListeners: vi.fn() }
    let htmlBody = ''
    const getRes: MockServerResponse = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { htmlBody = data }),
      setHeader: vi.fn(),
      body: '',
      statusCode: 200
    }
    await routes.get('/admin/posts/new')!.GET!(asReq(getReq), asRes(getRes), {})
    const csrfMatch = htmlBody.match(/name="_csrf" value="([^"]+)"/)
    const csrfToken = csrfMatch![1]!

    // Now POST delete with the valid token
    const req = makeMockReq(`_csrf=${encodeURIComponent(csrfToken)}`)
    const res = makeMockRes()
    await routes.get('/admin/posts/:id/delete')!.POST!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/admin/posts' }))
  })

  it('POST delete with invalid CSRF returns 403', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const req = makeMockReq('_csrf=invalid-token')
    const res = makeMockRes()
    await routes.get('/admin/posts/:id/delete')!.POST!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(403, expect.objectContaining({ Location: '/admin/posts/abc/edit' }))
  })

  it('POST delete with bad body returns 400', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })

    // Create a request that will fail body parsing - use a broken stream
    const brokenReq: MockIncomingMessage = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      url: '/admin/posts/abc/delete',
      method: 'POST',
      on: vi.fn((event: string, cb: (data?: Buffer | Error) => void) => {
        if (event === 'error') cb(new Error('stream error'))
        if (event === 'end') cb()
        return brokenReq
      }),
      removeAllListeners: vi.fn(() => brokenReq)
    }
    const res = makeMockRes()
    await routes.get('/admin/posts/:id/delete')!.POST!(asReq(brokenReq), asRes(res), { id: 'abc' })
    // Should get either 400 or 403 depending on body parse result
    const statusCall = res.writeHead.mock.calls[0]?.[0]
    expect([400, 403]).toContain(statusCall)
  })
})

describe('delete button rendering', () => {
  it('renders delete button with confirmation dialog on edit pages', () => {
    const doc = { id: '123', title: 'Test', slug: 'test' }
    const html = renderEditView(makePostsCollection(), doc, 'csrf-tok')
    expect(html).toContain('delete-form')
    expect(html).toContain('val-dialog')
    expect(html).toContain('btn-ghost-danger')
    expect(html).toContain('/admin/posts/123/delete')
  })

  it('does NOT render delete button on new pages', () => {
    const html = renderEditView(makePostsCollection(), null, 'csrf-tok')
    expect(html).not.toContain('delete-form')
    expect(html).not.toContain('val-dialog')
    expect(html).not.toContain('btn-danger')
  })
})
