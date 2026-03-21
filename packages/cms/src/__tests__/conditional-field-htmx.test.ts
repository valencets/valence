import { describe, it, expect, vi } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { CollectionConfig } from '../schema/collection.js'

function makeConditionalCollection (): CollectionConfig {
  return collection({
    slug: 'articles',
    labels: { singular: 'Article', plural: 'Articles' },
    fields: [
      field.select({
        name: 'type',
        options: [
          { label: 'Free', value: 'free' },
          { label: 'Premium', value: 'premium' }
        ]
      }),
      field.text({
        name: 'premiumContent',
        condition: (data) => data['type'] === 'premium'
      })
    ]
  })
}

function makeSimpleCollection (): CollectionConfig {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.textarea({ name: 'body' })
    ]
  })
}

describe('renderEditView() htmx conditional field attributes', () => {
  it('adds htmx attributes to form when collection has conditional fields', () => {
    const col = makeConditionalCollection()
    const html = renderEditView(col, null)
    expect(html).toContain('hx-post=')
    expect(html).toContain('hx-trigger=')
    expect(html).toContain('hx-target=')
    expect(html).toContain('hx-swap=')
  })

  it('does NOT add htmx attributes when collection has no conditional fields', () => {
    const col = makeSimpleCollection()
    const html = renderEditView(col, null)
    expect(html).not.toContain('hx-post=')
    expect(html).not.toContain('hx-trigger=')
  })

  it('wraps fields in div.form-fields when conditions exist', () => {
    const col = makeConditionalCollection()
    const html = renderEditView(col, null)
    expect(html).toContain('class="form-fields"')
  })

  it('does NOT wrap fields in div.form-fields when no conditions exist', () => {
    const col = makeSimpleCollection()
    const html = renderEditView(col, null)
    expect(html).not.toContain('class="form-fields"')
  })

  it('adds condition-trigger class to inputs when collection has conditional fields', () => {
    const col = makeConditionalCollection()
    const html = renderEditView(col, null)
    expect(html).toContain('condition-trigger')
  })

  it('does NOT add condition-trigger class when no conditional fields', () => {
    const col = makeSimpleCollection()
    const html = renderEditView(col, null)
    expect(html).not.toContain('condition-trigger')
  })

  it('htmx form post targets the form-fields partial for new doc', () => {
    const col = makeConditionalCollection()
    const html = renderEditView(col, null)
    expect(html).toContain('hx-post="/admin/articles/new/form-fields"')
  })

  it('htmx form post targets the form-fields partial for existing doc', () => {
    const col = makeConditionalCollection()
    const doc = { id: '42', type: 'premium', premiumContent: 'secret' }
    const html = renderEditView(col, doc)
    expect(html).toContain('hx-post="/admin/articles/42/form-fields"')
  })

  it('htmx trigger is change from .condition-trigger elements', () => {
    const col = makeConditionalCollection()
    const html = renderEditView(col, null)
    expect(html).toContain('hx-trigger="change from:.condition-trigger"')
  })

  it('htmx swap target is .form-fields', () => {
    const col = makeConditionalCollection()
    const html = renderEditView(col, null)
    expect(html).toContain('hx-target=".form-fields"')
  })

  it('htmx swap mode is innerHTML', () => {
    const col = makeConditionalCollection()
    const html = renderEditView(col, null)
    expect(html).toContain('hx-swap="innerHTML"')
  })
})

describe('POST /admin/:slug/new/form-fields route', () => {
  it('registers POST /admin/:slug/new/form-fields route when collection has conditions', () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const entry = routes.get('/admin/articles/new/form-fields')
    expect(entry?.POST).toBeDefined()
  })

  it('does NOT register form-fields route for collections without conditions', () => {
    const registry = createCollectionRegistry()
    registry.register(makeSimpleCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const entry = routes.get('/admin/posts/new/form-fields')
    expect(entry).toBeUndefined()
  })

  it('returns 200 with HTML fragment for new doc form-fields', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/articles/new/form-fields')?.POST
    const body = 'type=free'
    const req = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(body))
        if (event === 'end') cb()
        return req
      }),
      removeAllListeners: vi.fn()
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(200)
    const html = writes.join('')
    expect(html).toContain('name="type"')
  })

  it('excludes fields whose condition is false for the posted data', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/articles/new/form-fields')?.POST
    const body = 'type=free'
    const req = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(body))
        if (event === 'end') cb()
        return req
      }),
      removeAllListeners: vi.fn()
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    const html = writes.join('')
    expect(html).not.toContain('name="premiumContent"')
  })

  it('includes fields whose condition is true for the posted data', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/articles/new/form-fields')?.POST
    const body = 'type=premium'
    const req = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(body))
        if (event === 'end') cb()
        return req
      }),
      removeAllListeners: vi.fn()
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    const html = writes.join('')
    expect(html).toContain('name="premiumContent"')
  })

  it('returns HTML fragment not full page (no DOCTYPE)', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/articles/new/form-fields')?.POST
    const body = 'type=premium'
    const req = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(body))
        if (event === 'end') cb()
        return req
      }),
      removeAllListeners: vi.fn()
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    const html = writes.join('')
    expect(html).not.toContain('<!DOCTYPE html>')
    expect(html).not.toContain('<html')
  })
})

describe('POST /admin/:slug/:id/form-fields route', () => {
  it('registers POST /admin/:slug/:id/form-fields route when collection has conditions', () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const entry = routes.get('/admin/articles/:id/form-fields')
    expect(entry?.POST).toBeDefined()
  })

  it('excludes fields whose condition is false for the posted data', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/articles/:id/form-fields')?.POST
    const body = 'type=free&premiumContent=hidden'
    const req = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(body))
        if (event === 'end') cb()
        return req
      }),
      removeAllListeners: vi.fn()
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, { id: '5' })
    const html = writes.join('')
    expect(html).not.toContain('name="premiumContent"')
  })

  it('includes fields whose condition is true for the posted data', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeConditionalCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/articles/:id/form-fields')?.POST
    const body = 'type=premium'
    const req = {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      on: vi.fn((event: string, cb: (chunk?: Buffer) => void) => {
        if (event === 'data') cb(Buffer.from(body))
        if (event === 'end') cb()
        return req
      }),
      removeAllListeners: vi.fn()
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, { id: '5' })
    const html = writes.join('')
    expect(html).toContain('name="premiumContent"')
  })
})
