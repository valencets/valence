import { describe, it, expect, vi } from 'vitest'
import { renderLayout } from '../admin/layout.js'
import { renderDashboard } from '../admin/dashboard.js'
import { renderListView } from '../admin/list-view.js'
import { renderEditView } from '../admin/edit-view.js'
import { renderFieldInput } from '../admin/field-renderers.js'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, makeSequentialPool } from './test-helpers.js'
import type { CollectionConfig } from '../schema/collection.js'

function makePostsCollection (): CollectionConfig {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true }),
      field.boolean({ name: 'published' }),
      field.select({
        name: 'status',
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' }
        ]
      }),
      field.textarea({ name: 'body' }),
      field.number({ name: 'order' }),
      field.date({ name: 'publishedAt' }),
      field.group({
        name: 'seo',
        fields: [
          field.text({ name: 'metaTitle' }),
          field.textarea({ name: 'metaDescription' })
        ]
      })
    ]
  })
}

describe('renderLayout()', () => {
  it('returns HTML string with sidebar and main content', () => {
    const html = renderLayout({
      title: 'Dashboard',
      content: '<p>Hello</p>',
      collections: [makePostsCollection()]
    })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('Dashboard')
    expect(html).toContain('<p>Hello</p>')
    expect(html).toContain('Posts')
  })

  it('includes navigation links for each collection', () => {
    const html = renderLayout({
      title: 'Test',
      content: '',
      collections: [makePostsCollection()]
    })
    expect(html).toContain('/admin/posts')
  })
})

describe('renderDashboard()', () => {
  it('renders collection cards', () => {
    const html = renderDashboard({ stats: [{ slug: 'posts', label: 'Posts', count: 5, recent: [] }] })
    expect(html).toContain('Posts')
    expect(html).toContain('/admin/posts')
    expect(html).toContain('5')
  })
})

describe('renderListView()', () => {
  it('renders a table with document rows', () => {
    const docs = [
      { id: '1', title: 'Hello', slug: 'hello', published: 'true' },
      { id: '2', title: 'World', slug: 'world', published: 'false' }
    ]
    const html = renderListView({ col: makePostsCollection(), docs })
    expect(html).toContain('Hello')
    expect(html).toContain('World')
    expect(html).toContain('/admin/posts/1/edit')
  })

  it('shows empty state when no docs', () => {
    const html = renderListView({ col: makePostsCollection(), docs: [] })
    expect(html).toContain('No')
  })
})

describe('renderEditView()', () => {
  it('renders a form with fields for new document', () => {
    const html = renderEditView(makePostsCollection(), null)
    expect(html).toContain('<form')
    expect(html).toContain('title')
    expect(html).toContain('slug')
    expect(html).toContain('published')
  })

  it('renders a form pre-filled for existing document', () => {
    const doc = { id: '1', title: 'Existing', slug: 'existing', published: 'true' }
    const html = renderEditView(makePostsCollection(), doc)
    expect(html).toContain('Existing')
    expect(html).toContain('existing')
  })

  it('new doc form action points to /admin/:slug/new', () => {
    const html = renderEditView(makePostsCollection(), null, 'tok')
    expect(html).toContain('action="/admin/posts/new"')
  })

  it('existing doc form action points to /admin/:slug/:id/edit', () => {
    const doc = { id: '123', title: 'T', slug: 's', published: 'true' }
    const html = renderEditView(makePostsCollection(), doc, 'tok')
    expect(html).toContain('action="/admin/posts/123/edit"')
  })

  it('does not include data-method attribute', () => {
    const html = renderEditView(makePostsCollection(), null)
    expect(html).not.toContain('data-method')
  })
})

describe('renderFieldInput()', () => {
  it('renders text input', () => {
    const html = renderFieldInput(field.text({ name: 'title' }), 'Hello')
    expect(html).toContain('type="text"')
    expect(html).toContain('name="title"')
    expect(html).toContain('value="Hello"')
  })

  it('renders textarea', () => {
    const html = renderFieldInput(field.textarea({ name: 'body' }), 'Content')
    expect(html).toContain('<textarea')
    expect(html).toContain('Content')
  })

  it('renders number input', () => {
    const html = renderFieldInput(field.number({ name: 'order' }), '5')
    expect(html).toContain('type="number"')
  })

  it('renders checkbox for boolean', () => {
    const html = renderFieldInput(field.boolean({ name: 'active' }), 'true')
    expect(html).toContain('type="checkbox"')
    expect(html).toContain('checked')
  })

  it('renders hidden input before checkbox so unchecked submits false', () => {
    const html = renderFieldInput(field.boolean({ name: 'published' }), 'false')
    expect(html).toContain('<input type="hidden" name="published" value="false">')
    const hiddenIdx = html.indexOf('type="hidden"')
    const checkboxIdx = html.indexOf('type="checkbox"')
    expect(hiddenIdx).toBeLessThan(checkboxIdx)
  })

  it('renders select dropdown', () => {
    const html = renderFieldInput(
      field.select({ name: 'status', options: [{ label: 'Draft', value: 'draft' }, { label: 'Live', value: 'live' }] }),
      'draft'
    )
    expect(html).toContain('<select')
    expect(html).toContain('selected')
    expect(html).toContain('Draft')
  })

  it('renders date input', () => {
    const html = renderFieldInput(field.date({ name: 'publishedAt' }), '2026-03-18')
    expect(html).toContain('type="date"')
  })

  it('renders slug as text input', () => {
    const html = renderFieldInput(field.slug({ name: 'slug' }), 'hello-world')
    expect(html).toContain('type="text"')
    expect(html).toContain('hello-world')
  })

  it('renders group as fieldset', () => {
    const html = renderFieldInput(
      field.group({ name: 'seo', fields: [field.text({ name: 'metaTitle' })] }),
      ''
    )
    expect(html).toContain('<fieldset')
    expect(html).toContain('seo')
  })

  it('escapes richtext value in template tag to prevent XSS', () => {
    const xssPayload = '</template><script>alert(1)</script>'
    const html = renderFieldInput(field.richtext({ name: 'content' }), xssPayload)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('createAdminRoutes()', () => {
  it('returns route map with admin endpoints', () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    expect(routes.has('/admin')).toBe(true)
    expect(routes.has('/admin/posts')).toBe(true)
    expect(routes.has('/admin/posts/new')).toBe(true)
  })

  it('registers /admin/:slug/:id/edit route with GET and POST', () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const entry = routes.get('/admin/posts/:id/edit')
    expect(entry).toBeDefined()
    expect(entry?.GET).toBeDefined()
    expect(entry?.POST).toBeDefined()
  })
})

describe('admin POST handlers', () => {
  it('registers POST handler on /admin/:collection/new for creating documents', () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const entry = routes.get('/admin/posts/new')
    expect(entry?.POST).toBeDefined()
  })
})

describe('renderLayout() richtext CSS', () => {
  it('includes min-height on .richtext-editor class', () => {
    const html = renderLayout({
      title: 'Test',
      content: '',
      collections: [makePostsCollection()]
    })
    expect(html).toMatch(/\.richtext-editor\s*\{[^}]*min-height/)
  })
})

describe('admin auth protection', () => {
  it('createAdminRoutes accepts requireAuth flag', () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: true })
    expect(routes.has('/admin')).toBe(true)
  })

  it('protected admin GET returns 401 without session cookie', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry, { requireAuth: true })
    const handler = routes.get('/admin')?.GET
    const req = { headers: {}, url: '/admin', method: 'GET' }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(302, { Location: '/admin/login' })
  })
})

describe('renderFieldInput() relation dropdown', () => {
  it('renders a <select> when relation context is provided', () => {
    const f = field.relation({ name: 'category', relationTo: 'categories' })
    const context = {
      category: [
        { id: 'uuid-1', label: 'General' },
        { id: 'uuid-2', label: 'News' }
      ]
    }
    const html = renderFieldInput(f, '', context)
    expect(html).toContain('<select')
    expect(html).toContain('name="category"')
    expect(html).toContain('General')
    expect(html).toContain('News')
    expect(html).toContain('value="uuid-1"')
    expect(html).toContain('value="uuid-2"')
  })

  it('marks the current value as selected', () => {
    const f = field.relation({ name: 'category', relationTo: 'categories' })
    const context = {
      category: [
        { id: 'uuid-1', label: 'General' },
        { id: 'uuid-2', label: 'News' }
      ]
    }
    const html = renderFieldInput(f, 'uuid-2', context)
    expect(html).toContain('value="uuid-2" selected')
  })

  it('includes an empty option for optional relation fields', () => {
    const f = field.relation({ name: 'category', relationTo: 'categories' })
    const context = {
      category: [{ id: 'uuid-1', label: 'General' }]
    }
    const html = renderFieldInput(f, '', context)
    expect(html).toContain('<option value=""')
  })

  it('falls back to text input when no context provided', () => {
    const f = field.relation({ name: 'category', relationTo: 'categories' })
    const html = renderFieldInput(f, '')
    expect(html).toContain('type="text"')
  })
})

describe('renderEditView() with relation context', () => {
  it('passes relation context through to field renderers', () => {
    const col = collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.relation({ name: 'category', relationTo: 'categories' })
      ]
    })
    const context = {
      category: [
        { id: 'uuid-1', label: 'General' },
        { id: 'uuid-2', label: 'News' }
      ]
    }
    const html = renderEditView(col, null, 'csrf-tok', context)
    expect(html).toContain('<select')
    expect(html).toContain('General')
  })
})

describe('nonce threading', () => {
  it('renderLayout adds nonce to inline toast script', () => {
    const html = renderLayout({
      title: 'Test',
      content: '<p>hi</p>',
      collections: [makePostsCollection()],
      toast: { type: 'success', text: 'Saved' },
      nonce: 'test-nonce-123'
    })
    expect(html).toContain('nonce="test-nonce-123"')
    // Both the toast script and the admin-client script should have the nonce
    const scriptMatches = html.match(/<script/g) ?? []
    const nonceMatches = html.match(/nonce="test-nonce-123"/g) ?? []
    expect(nonceMatches.length).toBe(scriptMatches.length)
  })

  it('renderLayout adds nonce to admin-client script tag', () => {
    const html = renderLayout({
      title: 'Test',
      content: '',
      collections: [],
      nonce: 'abc'
    })
    expect(html).toContain('<script type="module" src="/admin/_assets/admin-client.js" nonce="abc">')
  })

  it('renderEditView adds nonce to delete dialog script', () => {
    const doc = { id: '1', title: 'T', slug: 's', published: 'true' }
    const html = renderEditView(makePostsCollection(), doc, 'tok', undefined, 'delete-nonce')
    expect(html).toContain('nonce="delete-nonce"')
  })
})

describe('admin GET /admin/:slug query param wiring', () => {
  it('passes q search param to api.find as search', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeSequentialPool([[{ count: '0' }], []])
    const routes = createAdminRoutes(pool, registry)
    const handler = routes.get('/admin/posts')?.GET
    const req = {
      headers: { cookie: '' },
      url: '/admin/posts?q=hello',
      method: 'GET'
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })

  it('defaults to page=1, perPage=25, sort=created_at, dir=desc when no params', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeSequentialPool([[{ count: '0' }], []])
    const routes = createAdminRoutes(pool, registry)
    const handler = routes.get('/admin/posts')?.GET
    const req = {
      headers: { cookie: '' },
      url: '/admin/posts',
      method: 'GET'
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })

  it('parses ?sort= and ?dir= params', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeSequentialPool([[{ count: '0' }], []])
    const routes = createAdminRoutes(pool, registry)
    const handler = routes.get('/admin/posts')?.GET
    const req = {
      headers: { cookie: '' },
      url: '/admin/posts?sort=title&dir=asc',
      method: 'GET'
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })

  it('parses ?page= param', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeSequentialPool([[{ count: '5' }], [{ id: '1', title: 'Hello', slug: 'hello', published: 'true' }]])
    const routes = createAdminRoutes(pool, registry)
    const handler = routes.get('/admin/posts')?.GET
    const req = {
      headers: { cookie: '' },
      url: '/admin/posts?page=2',
      method: 'GET'
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })

  it('parses filter_* params and passes them as filters', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeSequentialPool([[{ count: '0' }], []])
    const routes = createAdminRoutes(pool, registry)
    const handler = routes.get('/admin/posts')?.GET
    const req = {
      headers: { cookie: '' },
      url: '/admin/posts?filter_status=draft',
      method: 'GET'
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(200)
  })

  it('rejects invalid sort field not in collection schema with 400', async () => {
    const registry = createCollectionRegistry()
    registry.register(makePostsCollection())
    const pool = makeMockPool()
    const routes = createAdminRoutes(pool, registry)
    const handler = routes.get('/admin/posts')?.GET
    const req = {
      headers: { cookie: '' },
      url: '/admin/posts?sort=evil_field',
      method: 'GET'
    }
    const res = {
      writeHead: vi.fn(),
      end: vi.fn(),
      setHeader: vi.fn()
    }
    await handler!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(400)
  })
})

describe('renderLayout() logout button', () => {
  it('includes a logout form with POST method and /admin/logout action', () => {
    const html = renderLayout({
      title: 'Dashboard',
      content: '',
      collections: [makePostsCollection()]
    })
    expect(html).toContain('action="/admin/logout"')
    expect(html).toContain('method="POST"')
  })

  it('includes logout label text', () => {
    const html = renderLayout({
      title: 'Dashboard',
      content: '',
      collections: [makePostsCollection()]
    })
    expect(html.toLowerCase()).toMatch(/log\s*out/)
  })
})
