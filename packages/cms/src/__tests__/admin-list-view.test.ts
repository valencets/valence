import { describe, it, expect } from 'vitest'
import { renderListView } from '../admin/list-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import type { CollectionConfig } from '../schema/collection.js'

function makeCol (): CollectionConfig {
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
      })
    ]
  })
}

const baseDocs = [
  { id: '1', title: 'Hello', slug: 'hello', published: 'true', status: 'draft' },
  { id: '2', title: 'World', slug: 'world', published: 'false', status: 'published' }
]

describe('renderListView() — search bar', () => {
  it('renders search form with method GET', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('<form')
    expect(html).toContain('method="GET"')
  })

  it('renders search input with type=search and name=q', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('type="search"')
    expect(html).toContain('name="q"')
  })

  it('preserves current query value in search input', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, query: 'hello world' })
    expect(html).toContain('value="hello world"')
  })

  it('HTML-escapes query value to prevent XSS', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, query: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
})

describe('renderListView() — column headers with sort links', () => {
  it('renders clickable column header links', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('sort=title')
  })

  it('renders sort link with dir=asc by default', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('dir=asc')
  })

  it('shows sort indicator arrow on active sort column', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, sort: 'title', dir: 'asc' })
    expect(html).toContain('▲')
  })

  it('shows desc arrow when sorted descending', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, sort: 'title', dir: 'desc' })
    expect(html).toContain('▼')
  })

  it('toggles sort direction to desc when clicking active asc sort column', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, sort: 'title', dir: 'asc' })
    expect(html).toContain('sort=title')
    expect(html).toContain('dir=desc')
  })

  it('toggles sort direction to asc when clicking active desc sort column', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, sort: 'title', dir: 'desc' })
    expect(html).toContain('dir=asc')
  })
})

describe('renderListView() — filter dropdowns for select fields', () => {
  it('renders a filter select for select-type fields', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('name="filter_status"')
    expect(html).toContain('<select')
  })

  it('renders select options including blank (All) option', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('<option value="">All</option>')
  })

  it('renders field options in the filter select', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('value="draft"')
    expect(html).toContain('value="published"')
  })

  it('marks current filter value as selected', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, filters: { filter_status: 'draft' } })
    expect(html).toContain('value="draft" selected')
  })
})

describe('renderListView() — boolean field three-state filter', () => {
  it('renders All / Yes / No filter links for boolean fields', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('filter_published')
    expect(html).toContain('All')
    expect(html).toContain('Yes')
    expect(html).toContain('No')
  })

  it('renders true filter link for boolean field', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('filter_published=true')
  })

  it('renders false filter link for boolean field', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('filter_published=false')
  })
})

describe('renderListView() — pagination', () => {
  const pagination = { totalDocs: 25, page: 2, totalPages: 3, hasNextPage: true, hasPrevPage: true }

  it('renders page indicator', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination })
    expect(html).toContain('Page 2 of 3')
  })

  it('renders First, Prev, Next, Last links', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination })
    expect(html).toContain('First')
    expect(html).toContain('Prev')
    expect(html).toContain('Next')
    expect(html).toContain('Last')
  })

  it('First page link points to page=1', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination })
    expect(html).toContain('page=1')
  })

  it('Last page link points to totalPages', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination })
    expect(html).toContain('page=3')
  })

  it('Prev link points to page - 1', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination })
    expect(html).toContain('page=1')
  })

  it('Next link points to page + 1', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination })
    expect(html).toContain('page=3')
  })

  it('preserves search param in pagination links', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination, query: 'hello' })
    expect(html).toContain('q=hello')
  })

  it('preserves sort param in pagination links', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination, sort: 'title', dir: 'asc' })
    expect(html).toContain('sort=title')
  })

  it('preserves filter params in pagination links', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination, filters: { filter_status: 'draft' } })
    expect(html).toContain('filter_status=draft')
  })

  it('disables First/Prev on first page', () => {
    const firstPagination = { totalDocs: 25, page: 1, totalPages: 3, hasNextPage: true, hasPrevPage: false }
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination: firstPagination })
    expect(html).toContain('aria-disabled="true"')
  })

  it('disables Next/Last on last page', () => {
    const lastPagination = { totalDocs: 25, page: 3, totalPages: 3, hasNextPage: false, hasPrevPage: true }
    const html = renderListView({ col: makeCol(), docs: baseDocs, pagination: lastPagination })
    expect(html).toContain('aria-disabled="true"')
  })
})

describe('renderListView() — empty state', () => {
  it('shows empty state message when no docs', () => {
    const html = renderListView({ col: makeCol(), docs: [] })
    expect(html).toContain('No')
  })

  it('shows create link in empty state', () => {
    const html = renderListView({ col: makeCol(), docs: [] })
    expect(html).toContain('/admin/posts/new')
  })
})

describe('renderListView() — listFields config', () => {
  function makeColWithListFields (): CollectionConfig {
    return collection({
      slug: 'articles',
      labels: { singular: 'Article', plural: 'Articles' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.text({ name: 'author', required: true }),
        field.text({ name: 'category' }),
        field.text({ name: 'excerpt' }),
        field.boolean({ name: 'featured' })
      ],
      admin: {
        listFields: ['title', 'author', 'category']
      }
    })
  }

  const docs = [
    { id: 'a1', title: 'Article One', author: 'Alice', category: 'Tech', excerpt: 'Short description', featured: 'true' },
    { id: 'a2', title: 'Article Two', author: 'Bob', category: 'Life', excerpt: 'Another desc', featured: 'false' }
  ]

  it('renders columns specified in listFields when configured', () => {
    const html = renderListView({ col: makeColWithListFields(), docs })
    expect(html).toContain('sort=title')
    expect(html).toContain('sort=author')
    expect(html).toContain('sort=category')
  })

  it('does not render columns excluded from listFields', () => {
    const html = renderListView({ col: makeColWithListFields(), docs })
    expect(html).not.toContain('sort=excerpt')
    expect(html).not.toContain('sort=featured')
  })

  it('renders cell values for listFields columns', () => {
    const html = renderListView({ col: makeColWithListFields(), docs })
    expect(html).toContain('Article One')
    expect(html).toContain('Alice')
    expect(html).toContain('Tech')
  })

  it('does not render cell values for excluded fields', () => {
    const html = renderListView({ col: makeColWithListFields(), docs })
    expect(html).not.toContain('Short description')
  })

  it('falls back to first 3 fields when listFields is not configured', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('sort=title')
    expect(html).toContain('sort=slug')
    expect(html).toContain('sort=published')
    expect(html).not.toContain('sort=status')
  })
})

describe('renderListView() — displayField config', () => {
  function makeColWithDisplayField (): CollectionConfig {
    return collection({
      slug: 'members',
      labels: { singular: 'Member', plural: 'Members' },
      fields: [
        field.text({ name: 'email', required: true }),
        field.text({ name: 'fullName', required: true }),
        field.text({ name: 'role' })
      ],
      admin: {
        displayField: 'fullName'
      }
    })
  }

  const docs = [
    { id: 'm1', email: 'alice@example.com', fullName: 'Alice Smith', role: 'Admin' },
    { id: 'm2', email: 'bob@example.com', fullName: 'Bob Jones', role: 'Editor' }
  ]

  it('renders displayField as the primary column header', () => {
    const html = renderListView({ col: makeColWithDisplayField(), docs })
    expect(html).toContain('sort=fullName')
  })

  it('renders cell values for the displayField', () => {
    const html = renderListView({ col: makeColWithDisplayField(), docs })
    expect(html).toContain('Alice Smith')
    expect(html).toContain('Bob Jones')
  })

  it('uses displayField as the first column', () => {
    const html = renderListView({ col: makeColWithDisplayField(), docs })
    const fullNameIdx = html.indexOf('sort=fullName')
    const emailIdx = html.indexOf('sort=email')
    expect(fullNameIdx).toBeLessThan(emailIdx)
  })

  it('falls back to default column order when displayField is not set', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    const titleIdx = html.indexOf('sort=title')
    const slugIdx = html.indexOf('sort=slug')
    expect(titleIdx).toBeLessThan(slugIdx)
  })
})

describe('renderListView() — displayField + listFields combined', () => {
  function makeColWithBoth (): CollectionConfig {
    return collection({
      slug: 'products',
      labels: { singular: 'Product', plural: 'Products' },
      fields: [
        field.text({ name: 'sku', required: true }),
        field.text({ name: 'name', required: true }),
        field.text({ name: 'description' }),
        field.text({ name: 'price' }),
        field.text({ name: 'stock' })
      ],
      admin: {
        displayField: 'name',
        listFields: ['name', 'sku', 'price']
      }
    })
  }

  const docs = [
    { id: 'p1', sku: 'SKU-001', name: 'Widget A', description: 'A widget', price: '9.99', stock: '100' },
    { id: 'p2', sku: 'SKU-002', name: 'Gadget B', description: 'A gadget', price: '19.99', stock: '50' }
  ]

  it('renders only the listFields columns', () => {
    const html = renderListView({ col: makeColWithBoth(), docs })
    expect(html).toContain('sort=name')
    expect(html).toContain('sort=sku')
    expect(html).toContain('sort=price')
    expect(html).not.toContain('sort=description')
    expect(html).not.toContain('sort=stock')
  })

  it('renders displayField as the first column when it is in listFields', () => {
    const html = renderListView({ col: makeColWithBoth(), docs })
    const nameIdx = html.indexOf('sort=name')
    const skuIdx = html.indexOf('sort=sku')
    expect(nameIdx).toBeLessThan(skuIdx)
  })

  it('renders cell values for the specified fields', () => {
    const html = renderListView({ col: makeColWithBoth(), docs })
    expect(html).toContain('Widget A')
    expect(html).toContain('SKU-001')
    expect(html).toContain('9.99')
  })

  it('does not render excluded field values', () => {
    const html = renderListView({ col: makeColWithBoth(), docs })
    expect(html).not.toContain('A widget')
  })
})

describe('renderListView() — bulk operation checkboxes', () => {
  it('renders a select-all checkbox in the table header', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('class="bulk-select-all"')
  })

  it('renders a row checkbox for each document', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('name="ids"')
    expect(html).toContain('value="1"')
    expect(html).toContain('value="2"')
  })

  it('row checkboxes have class bulk-row-check', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('class="bulk-row-check"')
  })

  it('wraps the table in a form with correct action URL', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('action="/admin/posts/bulk"')
    expect(html).toContain('method="POST"')
  })

  it('includes a CSRF hidden input when csrfToken is provided', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs, csrfToken: 'tok-abc' })
    expect(html).toContain('name="_csrf"')
    expect(html).toContain('value="tok-abc"')
  })

  it('does not include CSRF hidden input when csrfToken is not provided', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).not.toContain('name="_csrf"')
  })

  it('row checkbox uses the document id as value', () => {
    const docs = [{ id: 'abc-123', title: 'Test', slug: 'test', published: 'true', status: 'draft' }]
    const html = renderListView({ col: makeCol(), docs })
    expect(html).toContain('value="abc-123"')
  })
})
