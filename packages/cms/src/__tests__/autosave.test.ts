import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { renderEditView } from '../admin/edit-view.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, makeSequentialPool, asReq, asRes } from './test-helpers.js'
import type { MockIncomingMessage, MockServerResponse } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { CollectionConfig } from '../schema/collection.js'

function makeVersionedCollection (): CollectionConfig {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.richtext({ name: 'body' }),
      field.slug({ name: 'slug' })
    ],
    versions: { drafts: true }
  })
}

function makeNonVersionedCollection (): CollectionConfig {
  return collection({
    slug: 'pages',
    labels: { singular: 'Page', plural: 'Pages' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.textarea({ name: 'body' })
    ]
  })
}

function makeMockReq (body: string, cookie: string = ''): IncomingMessage {
  const req: MockIncomingMessage = {
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie },
    url: '/admin/posts/abc/autosave',
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

describe('autosave endpoint route registration', () => {
  it('registers POST /admin/:slug/:id/autosave for versioned collections', () => {
    const registry = createCollectionRegistry()
    registry.register(makeVersionedCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const entry = routes.get('/admin/posts/:id/autosave')
    expect(entry).toBeDefined()
    expect(entry?.POST).toBeDefined()
  })

  it('does NOT register autosave route for non-versioned collections', () => {
    const registry = createCollectionRegistry()
    registry.register(makeNonVersionedCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const entry = routes.get('/admin/pages/:id/autosave')
    expect(entry).toBeUndefined()
  })
})

describe('autosave endpoint POST handler', () => {
  it('returns 403 with invalid CSRF token', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeVersionedCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const req = makeMockReq('_csrf=invalid&title=Hello')
    const res = makeMockRes()
    await routes.get('/admin/posts/:id/autosave')!.POST!(req, res, { id: 'abc' })
    expect(res.writeHead).toHaveBeenCalledWith(403)
    const body = JSON.parse(res.end.mock.calls[0]?.[0] ?? '{}') as { success: boolean; error: string }
    expect(body.success).toBe(false)
    expect(body.error).toContain('CSRF')
  })

  it('returns JSON { success: true, savedAt } on valid autosave', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeVersionedCollection())
    const pool = makeSequentialPool([
      // For update query
      [{ id: 'abc', title: 'Updated Title', slug: 'updated', _status: 'draft' }]
    ])
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })

    // Get a valid CSRF token
    const getReq: MockIncomingMessage = { headers: {}, url: '/admin/posts/abc/edit', method: 'GET', on: vi.fn(), removeAllListeners: vi.fn() }
    let htmlBody = ''
    const getRes: MockServerResponse = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { htmlBody = data }),
      setHeader: vi.fn(),
      body: '',
      statusCode: 200
    }
    // Hit edit page to get valid CSRF token
    const editEntry = routes.get('/admin/posts/:id/edit')
    await editEntry!.GET!(asReq(getReq), asRes(getRes), { id: 'abc' })
    const csrfMatch = htmlBody.match(/name="_csrf" value="([^"]+)"/)
    const csrfToken = csrfMatch![1]!

    const req = makeMockReq(`_csrf=${encodeURIComponent(csrfToken)}&title=Updated+Title&slug=updated`)
    const res = makeMockRes()
    await routes.get('/admin/posts/:id/autosave')!.POST!(req, res, { id: 'abc' })

    const statusCode = res.writeHead.mock.calls[0]?.[0]
    expect(statusCode).toBe(200)
    const body = JSON.parse(res.end.mock.calls[0]?.[0] ?? '{}') as { success: boolean; savedAt: string }
    expect(body.success).toBe(true)
    expect(typeof body.savedAt).toBe('string')
    expect(new Date(body.savedAt).getTime()).toBeGreaterThan(0)
  })

  it('sets Content-Type application/json', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeVersionedCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const req = makeMockReq('_csrf=invalid&title=Hello')
    const res = makeMockRes()
    await routes.get('/admin/posts/:id/autosave')!.POST!(req, res, { id: 'abc' })
    const contentTypeCall = res.setHeader.mock.calls.find(
      (c: string[]) => c[0] === 'Content-Type'
    )
    expect(contentTypeCall).toBeDefined()
    expect(contentTypeCall?.[1]).toContain('application/json')
  })

  it('returns 400 when body parse fails', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeVersionedCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })

    const brokenReq: MockIncomingMessage = {
      headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: '' },
      url: '/admin/posts/abc/autosave',
      method: 'POST',
      on: vi.fn((event: string, cb: (data?: Buffer | Error) => void) => {
        if (event === 'error') cb(new Error('stream error'))
        if (event === 'end') cb()
        return brokenReq
      }),
      removeAllListeners: vi.fn(() => brokenReq)
    }
    const res = makeMockRes()
    await routes.get('/admin/posts/:id/autosave')!.POST!(asReq(brokenReq), asRes(res), { id: 'abc' })
    const statusCode = res.writeHead.mock.calls[0]?.[0]
    expect([400, 403]).toContain(statusCode)
  })
})

describe('autosave indicator HTML in edit view', () => {
  it('renders autosave indicator for versioned collection with existing doc', () => {
    const html = renderEditView(makeVersionedCollection(), { id: '1', title: 'Test', body: '', slug: '', _status: 'draft' })
    expect(html).toContain('val-autosave')
  })

  it('renders autosave indicator for versioned collection on new doc', () => {
    const html = renderEditView(makeVersionedCollection(), null)
    expect(html).toContain('val-autosave')
  })

  it('does NOT render autosave indicator for non-versioned collection', () => {
    const html = renderEditView(makeNonVersionedCollection(), { id: '1', title: 'Test', body: '' })
    expect(html).not.toContain('autosave-indicator')
  })

  it('autosave indicator has initial "Saved" state class', () => {
    const html = renderEditView(makeVersionedCollection(), { id: '1', title: 'Test', body: '', slug: '', _status: 'draft' })
    expect(html).toContain('val-autosave')
  })
})
