import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeSequentialPool } from './test-helpers.js'

/**
 * Tests for Phase 3 of VAL-192: relation dropdown labels use target collection's displayField.
 *
 * The buildRelationContext inner function inside createAdminRoutes resolves labels for
 * relation <select> options. These tests verify it uses admin.displayField from the
 * target collection when configured, falling back to the first text field otherwise.
 */

describe('relation dropdown — uses displayField from target collection', () => {
  it('uses displayField as the label when target collection has admin.displayField', async () => {
    // The target "authors" collection has displayField: 'fullName'
    const authors = collection({
      slug: 'authors',
      fields: [
        field.text({ name: 'email', required: true }),
        field.text({ name: 'fullName', required: true })
      ],
      admin: {
        displayField: 'fullName'
      }
    })

    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.relation({ name: 'author', relationTo: 'authors' })
      ]
    })

    const registry = createCollectionRegistry()
    registry.register(authors)
    registry.register(posts)

    // Pool returns authors rows when queried for relation options
    const pool = makeSequentialPool([
      // findByID for the doc being edited
      [{ id: 'p1', title: 'Hello', author: 'a1' }],
      // find for authors relation context
      [
        { id: 'a1', email: 'alice@example.com', fullName: 'Alice Smith' },
        { id: 'a2', email: 'bob@example.com', fullName: 'Bob Jones' }
      ]
    ])

    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/posts/:id/edit')?.GET

    const req = {
      headers: { cookie: '' },
      url: '/admin/posts/p1/edit',
      method: 'GET'
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }

    await handler!(req as never, res as never, { id: 'p1' })

    const html = writes.join('')
    // Should use fullName (displayField) as option labels, not email (first text field)
    expect(html).toContain('Alice Smith')
    expect(html).toContain('Bob Jones')
  })

  it('falls back to first text field when target collection has no displayField', async () => {
    // The target "categories" collection has no displayField configured
    const categories = collection({
      slug: 'categories',
      fields: [
        field.text({ name: 'name', required: true }),
        field.text({ name: 'description' })
      ]
      // no admin.displayField
    })

    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.relation({ name: 'category', relationTo: 'categories' })
      ]
    })

    const registry = createCollectionRegistry()
    registry.register(categories)
    registry.register(posts)

    const pool = makeSequentialPool([
      // findByID for the doc being edited
      [{ id: 'p1', title: 'Hello', category: 'c1' }],
      // find for categories relation context
      [
        { id: 'c1', name: 'Technology', description: 'Tech content' },
        { id: 'c2', name: 'Lifestyle', description: 'Life content' }
      ]
    ])

    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/posts/:id/edit')?.GET

    const req = {
      headers: { cookie: '' },
      url: '/admin/posts/p1/edit',
      method: 'GET'
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }

    await handler!(req as never, res as never, { id: 'p1' })

    const html = writes.join('')
    // Falls back to first text field "name"
    expect(html).toContain('Technology')
    expect(html).toContain('Lifestyle')
  })

  it('uses displayField instead of first text field when both exist', async () => {
    // Target collection: first text field is 'code', but displayField is 'title'
    const products = collection({
      slug: 'products',
      fields: [
        field.text({ name: 'code', required: true }),
        field.text({ name: 'title', required: true }),
        field.text({ name: 'description' })
      ],
      admin: {
        displayField: 'title'
      }
    })

    const orders = collection({
      slug: 'orders',
      fields: [
        field.text({ name: 'ref', required: true }),
        field.relation({ name: 'product', relationTo: 'products' })
      ]
    })

    const registry = createCollectionRegistry()
    registry.register(products)
    registry.register(orders)

    const pool = makeSequentialPool([
      // findByID for the doc being edited
      [{ id: 'o1', ref: 'ORD-001', product: 'prod1' }],
      // find for products relation context
      [
        { id: 'prod1', code: 'WGT-A', title: 'Widget Alpha', description: 'A great widget' },
        { id: 'prod2', code: 'WGT-B', title: 'Widget Beta', description: 'Another widget' }
      ]
    ])

    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/orders/:id/edit')?.GET

    const req = {
      headers: { cookie: '' },
      url: '/admin/orders/o1/edit',
      method: 'GET'
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }

    await handler!(req as never, res as never, { id: 'o1' })

    const html = writes.join('')
    // Should show 'Widget Alpha' and 'Widget Beta' (from displayField 'title')
    // NOT 'WGT-A' and 'WGT-B' (from first text field 'code')
    expect(html).toContain('Widget Alpha')
    expect(html).toContain('Widget Beta')
    // The raw codes should NOT appear as option labels
    // (they might appear as values but not as label text)
    const selectHtml = html.slice(html.indexOf('name="product"'))
    expect(selectHtml).not.toContain('>WGT-A<')
    expect(selectHtml).not.toContain('>WGT-B<')
  })

  it('also works for the /new route (no pre-existing doc)', async () => {
    const tags = collection({
      slug: 'tags',
      fields: [
        field.text({ name: 'slug', required: true }),
        field.text({ name: 'label', required: true })
      ],
      admin: {
        displayField: 'label'
      }
    })

    const articles = collection({
      slug: 'articles',
      fields: [
        field.text({ name: 'title', required: true }),
        field.relation({ name: 'tag', relationTo: 'tags' })
      ]
    })

    const registry = createCollectionRegistry()
    registry.register(tags)
    registry.register(articles)

    const pool = makeSequentialPool([
      // find for tags relation context (no findByID since this is /new)
      [
        { id: 't1', slug: 'tech', label: 'Technology' },
        { id: 't2', slug: 'life', label: 'Lifestyle' }
      ]
    ])

    const routes = createAdminRoutes(pool, registry, { requireAuth: false })
    const handler = routes.get('/admin/articles/new')?.GET

    const req = {
      headers: { cookie: '' },
      url: '/admin/articles/new',
      method: 'GET'
    }
    const writes: string[] = []
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { writes.push(data) }),
      setHeader: vi.fn()
    }

    await handler!(req as never, res as never, {})

    const html = writes.join('')
    // Should use label (displayField) not slug (first text field)
    expect(html).toContain('Technology')
    expect(html).toContain('Lifestyle')
  })
})
