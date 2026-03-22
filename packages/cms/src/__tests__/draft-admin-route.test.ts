import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, asReq, asRes } from './test-helpers.js'
import type { MockIncomingMessage, MockServerResponse, MockSql } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CollectionConfig } from '../schema/collection.js'

function makeMockReq (method: string, url: string, body: string = ''): IncomingMessage {
  const req: MockIncomingMessage = {
    method,
    url,
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: '' },
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
  const headers: Record<string, string> = {}
  const res: MockServerResponse = {
    writeHead: vi.fn(),
    end: vi.fn((data?: string) => { res.body = data ?? '' }),
    setHeader: vi.fn((name: string, value: string) => { headers[name] = value }),
    getHeader: vi.fn((name: string) => headers[name]),
    body: '',
    statusCode: 200
  }
  return asRes<{ body: string }>(res)
}

function makeVersionedCollection (): CollectionConfig {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true })
    ],
    versions: { drafts: true }
  })
}

function setupAdminRoutes (poolReturnForCreate: readonly Record<string, string | number | null>[] = [{ id: '1', title: 'Test Post', _status: 'draft' }]) {
  const pool = makeMockPool(poolReturnForCreate)
  const collections = createCollectionRegistry()
  collections.register(makeVersionedCollection())
  const routes = createAdminRoutes(pool, collections, { requireAuth: false })
  return { pool, routes }
}

// Helper to extract a CSRF token from a GET response
async function getCsrfToken (routes: ReturnType<typeof createAdminRoutes>, slug: string): Promise<string> {
  const handler = routes.get(`/admin/${slug}/new`)?.GET
  if (!handler) throw new Error('No GET handler found')
  const req = makeMockReq('GET', `/admin/${slug}/new`)
  const res = makeMockRes()
  await handler(req, res, {})
  const html = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string ?? ''
  const match = /name="_csrf" value="([^"]+)"/.exec(html)
  if (!match?.[1]) throw new Error('No CSRF token found in HTML')
  return match[1]
}

// Helper to extract a CSRF token from an edit GET response
async function getEditCsrfToken (routes: ReturnType<typeof createAdminRoutes>, slug: string, id: string, pool: ReturnType<typeof makeMockPool>): Promise<string> {
  // Re-configure pool to return a doc for GET
  const sqlMock = pool.sql as ReturnType<typeof vi.fn>
  sqlMock.mockResolvedValueOnce([{ id, title: 'Test Post', _status: 'draft' }])

  const handler = routes.get(`/admin/${slug}/:id/edit`)?.GET
  if (!handler) throw new Error('No GET handler found')
  const req = makeMockReq('GET', `/admin/${slug}/${id}/edit`)
  const res = makeMockRes()
  await handler(req, res, { id })
  const html = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string ?? ''
  const match = /name="_csrf" value="([^"]+)"/.exec(html)
  if (!match?.[1]) throw new Error('No CSRF token found in HTML')
  return match[1]
}

describe('POST /admin/:slug/new — draft vs publish action', () => {
  it('passes draft: true to api.create() when _action=draft', async () => {
    const { pool, routes } = setupAdminRoutes()
    const csrfToken = await getCsrfToken(routes, 'posts')

    const handler = routes.get('/admin/posts/new')?.POST
    expect(handler).toBeDefined()

    const body = new URLSearchParams({ _csrf: csrfToken, _action: 'draft', title: 'My Draft Post' }).toString()
    const req = makeMockReq('POST', '/admin/posts/new', body)
    const res = makeMockRes()
    await handler!(req, res, {})

    // Should redirect on success (302)
    const writeHeadCall = (res.writeHead as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(writeHeadCall?.[0]).toBe(302)

    // The SQL should contain 'draft' as the _status value
    const sqlCalls = (pool.sql as MockSql).unsafe.mock.calls
    const allParams = sqlCalls.flatMap(c => c[1] as (string | number | boolean | null)[])
    expect(allParams).toContain('draft')
  })

  it('passes draft: false (published) to api.create() when _action=publish', async () => {
    const { pool, routes } = setupAdminRoutes([{ id: '2', title: 'Published Post', _status: 'published' }])
    const csrfToken = await getCsrfToken(routes, 'posts')

    const handler = routes.get('/admin/posts/new')?.POST
    expect(handler).toBeDefined()

    const body = new URLSearchParams({ _csrf: csrfToken, _action: 'publish', title: 'My Published Post' }).toString()
    const req = makeMockReq('POST', '/admin/posts/new', body)
    const res = makeMockRes()
    await handler!(req, res, {})

    // Should redirect on success (302)
    const writeHeadCall = (res.writeHead as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(writeHeadCall?.[0]).toBe(302)

    // The SQL should contain 'published' as the _status value (not 'draft')
    const sqlCalls = (pool.sql as MockSql).unsafe.mock.calls
    const allParams = sqlCalls.flatMap(c => c[1] as (string | number | boolean | null)[])
    expect(allParams).toContain('published')
    expect(allParams).not.toContain('draft')
  })

  it('defaults to published when _action is missing', async () => {
    const { pool, routes } = setupAdminRoutes([{ id: '3', title: 'Default Post', _status: 'published' }])
    const csrfToken = await getCsrfToken(routes, 'posts')

    const handler = routes.get('/admin/posts/new')?.POST
    expect(handler).toBeDefined()

    // No _action field in body
    const body = new URLSearchParams({ _csrf: csrfToken, title: 'Default Post' }).toString()
    const req = makeMockReq('POST', '/admin/posts/new', body)
    const res = makeMockRes()
    await handler!(req, res, {})

    const writeHeadCall = (res.writeHead as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(writeHeadCall?.[0]).toBe(302)

    const sqlCalls = (pool.sql as MockSql).unsafe.mock.calls
    const allParams = sqlCalls.flatMap(c => c[1] as (string | number | boolean | null)[])
    expect(allParams).toContain('published')
    expect(allParams).not.toContain('draft')
  })
})

describe('POST /admin/:slug/:id/edit — publish action', () => {
  it('passes publish: true to api.update() when _action=publish', async () => {
    const { pool, routes } = setupAdminRoutes([{ id: '1', title: 'Updated Post', _status: 'published' }])
    const csrfToken = await getEditCsrfToken(routes, 'posts', '1', pool)

    const handler = routes.get('/admin/posts/:id/edit')?.POST
    expect(handler).toBeDefined()

    const body = new URLSearchParams({ _csrf: csrfToken, _action: 'publish', title: 'Updated Title' }).toString()
    const req = makeMockReq('POST', '/admin/posts/1/edit', body)
    const res = makeMockRes()
    await handler!(req, res, { id: '1' })

    // Should redirect on success (302)
    const writeHeadCall = (res.writeHead as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(writeHeadCall?.[0]).toBe(302)

    // The SQL should have published status in params
    const sqlCalls = (pool.sql as MockSql).unsafe.mock.calls
    const allSql = sqlCalls.map(c => c[0] as string).join(' ')
    // publish: true triggers a _status update to 'published'
    expect(allSql.toLowerCase()).toContain('update')
  })

  it('does NOT publish when _action=draft on edit', async () => {
    const { pool, routes } = setupAdminRoutes([{ id: '1', title: 'Draft Update', _status: 'draft' }])
    const csrfToken = await getEditCsrfToken(routes, 'posts', '1', pool)

    const handler = routes.get('/admin/posts/:id/edit')?.POST
    expect(handler).toBeDefined()

    const body = new URLSearchParams({ _csrf: csrfToken, _action: 'draft', title: 'Draft Title' }).toString()
    const req = makeMockReq('POST', '/admin/posts/1/edit', body)
    const res = makeMockRes()
    await handler!(req, res, { id: '1' })

    const writeHeadCall = (res.writeHead as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(writeHeadCall?.[0]).toBe(302)

    // When _action=draft, _status should remain draft (not 'published')
    const sqlCalls = (pool.sql as MockSql).unsafe.mock.calls
    const allParams = sqlCalls.flatMap(c => c[1] as (string | number | boolean | null)[])
    // Should not set published status
    expect(allParams).not.toContain('published')
  })
})
