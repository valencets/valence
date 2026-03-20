import { describe, it, expect } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
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

describe('edit view draft/publish UI', () => {
  it('shows status badge for versioned collection with existing doc', () => {
    const html = renderEditView(versionedCol, { id: '1', title: 'Test', _status: 'draft' })
    expect(html).toContain('status-badge')
    expect(html).toContain('Draft')
  })

  it('shows Published badge when doc is published', () => {
    const html = renderEditView(versionedCol, { id: '1', title: 'Test', _status: 'published' })
    expect(html).toContain('Published')
    expect(html).toContain('status-published')
  })

  it('shows dual Save Draft / Publish buttons for versioned collections', () => {
    const html = renderEditView(versionedCol, { id: '1', title: 'Test', _status: 'draft' })
    expect(html).toContain('Save Draft')
    expect(html).toContain('Publish')
  })

  it('shows single Save button for non-versioned collections', () => {
    const html = renderEditView(normalCol, { id: '1', title: 'Test' })
    expect(html).toContain('Save')
    expect(html).not.toContain('Save Draft')
    expect(html).not.toContain('Publish')
  })

  it('shows Unpublish button for published versioned docs', () => {
    const html = renderEditView(versionedCol, { id: '1', title: 'Test', _status: 'published' })
    expect(html).toContain('Unpublish')
    expect(html).toContain('/unpublish')
  })

  it('does NOT show Unpublish button for draft docs', () => {
    const html = renderEditView(versionedCol, { id: '1', title: 'Test', _status: 'draft' })
    expect(html).not.toContain('Unpublish')
  })

  it('does NOT show status badge for new docs', () => {
    const html = renderEditView(versionedCol, null)
    expect(html).not.toContain('status-badge')
  })

  it('shows dual buttons for new versioned collection docs', () => {
    const html = renderEditView(versionedCol, null)
    expect(html).toContain('Save Draft')
    expect(html).toContain('Publish')
  })
})
