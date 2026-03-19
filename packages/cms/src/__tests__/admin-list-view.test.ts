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
