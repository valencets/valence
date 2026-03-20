import { describe, it, expect } from 'vitest'
import { renderListView } from '../admin/list-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

const versionedCol = collection({
  slug: 'posts',
  fields: [field.text({ name: 'title', required: true })],
  versions: { drafts: true }
})

const normalCol = collection({
  slug: 'pages',
  fields: [field.text({ name: 'title', required: true })]
})

describe('list view status column', () => {
  it('shows Status column header for versioned collections', () => {
    const html = renderListView({
      col: versionedCol,
      docs: [{ id: '1', title: 'Test', _status: 'published' }]
    })
    expect(html).toContain('<th>Status</th>')
  })

  it('shows status badge in table row', () => {
    const html = renderListView({
      col: versionedCol,
      docs: [{ id: '1', title: 'Test', _status: 'draft' }]
    })
    expect(html).toContain('status-badge')
    expect(html).toContain('Draft')
  })

  it('shows Published badge for published docs', () => {
    const html = renderListView({
      col: versionedCol,
      docs: [{ id: '1', title: 'Test', _status: 'published' }]
    })
    expect(html).toContain('Published')
    expect(html).toContain('status-published')
  })

  it('does NOT show Status column for non-versioned collections', () => {
    const html = renderListView({
      col: normalCol,
      docs: [{ id: '1', title: 'Test' }]
    })
    expect(html).not.toContain('<th>Status</th>')
    expect(html).not.toContain('status-badge')
  })

  it('shows status filter for versioned collections', () => {
    const html = renderListView({
      col: versionedCol,
      docs: [{ id: '1', title: 'Test', _status: 'draft' }]
    })
    expect(html).toContain('filter_status')
    expect(html).toContain('Draft')
    expect(html).toContain('Published')
  })

  it('does NOT show status filter for non-versioned collections', () => {
    const html = renderListView({
      col: normalCol,
      docs: [{ id: '1', title: 'Test' }]
    })
    expect(html).not.toContain('filter_status')
  })
})
