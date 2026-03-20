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
      field.slug({ name: 'slug', required: true })
    ]
  })
}

const baseDocs = [
  { id: '1', title: 'Hello', slug: 'hello' },
  { id: '2', title: 'World', slug: 'world' }
]

describe('renderListView() — bulk action bar', () => {
  it('renders a bulk-action-bar div', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('class="bulk-action-bar"')
  })

  it('bulk action bar is hidden by default', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('display:none')
  })

  it('renders a bulk-count span inside the action bar', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('class="bulk-count"')
    expect(html).toContain('0 selected')
  })

  it('renders the action select with name="action"', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('name="action"')
  })

  it('renders publish option in the action select', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('value="publish"')
    expect(html).toContain('Publish')
  })

  it('renders unpublish option in the action select', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('value="unpublish"')
    expect(html).toContain('Unpublish')
  })

  it('renders delete option in the action select', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('value="delete"')
    expect(html).toContain('Delete')
  })

  it('renders an Apply submit button', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    expect(html).toContain('type="submit"')
    expect(html).toContain('Apply')
  })

  it('action bar is inside the bulk form (appears before the table)', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    const barIdx = html.indexOf('bulk-action-bar')
    const tableIdx = html.indexOf('<table')
    expect(barIdx).toBeGreaterThan(-1)
    expect(tableIdx).toBeGreaterThan(-1)
    expect(barIdx).toBeLessThan(tableIdx)
  })

  it('action select has class form-select', () => {
    const html = renderListView({ col: makeCol(), docs: baseDocs })
    // The action select should have class="form-select" and name="action"
    expect(html).toContain('name="action"')
    expect(html).toMatch(/name="action"[^>]*class="form-select"|class="form-select"[^>]*name="action"/)
  })
})
