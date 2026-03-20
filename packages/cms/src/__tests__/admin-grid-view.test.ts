import { describe, it, expect } from 'vitest'
import { renderListView } from '../admin/list-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

const mediaCol = collection({
  slug: 'media',
  upload: true,
  fields: [field.text({ name: 'alt' })]
})

const normalCol = collection({
  slug: 'posts',
  fields: [field.text({ name: 'title' })]
})

describe('list view grid mode', () => {
  it('renders grid view when viewMode is grid', () => {
    const html = renderListView({
      col: mediaCol,
      docs: [{ id: '1', alt: 'Test', filename: 'photo.jpg', storedPath: 'abc.jpg', mimeType: 'image/jpeg' }],
      viewMode: 'grid'
    })
    expect(html).toContain('grid-view')
    expect(html).toContain('grid-card')
    expect(html).not.toContain('<table>')
  })

  it('renders table view by default', () => {
    const html = renderListView({
      col: mediaCol,
      docs: [{ id: '1', alt: 'Test' }]
    })
    expect(html).toContain('<table>')
    expect(html).not.toContain('grid-view')
  })

  it('shows image thumbnails in grid cards', () => {
    const html = renderListView({
      col: mediaCol,
      docs: [{ id: '1', alt: 'Photo', storedPath: 'abc.jpg', mimeType: 'image/jpeg', filename: 'photo.jpg' }],
      viewMode: 'grid'
    })
    expect(html).toContain('grid-thumb')
    expect(html).toContain('/media/abc.jpg')
  })

  it('shows file type placeholder for non-image files', () => {
    const html = renderListView({
      col: mediaCol,
      docs: [{ id: '1', alt: '', storedPath: 'doc.pdf', mimeType: 'application/pdf', filename: 'doc.pdf' }],
      viewMode: 'grid'
    })
    expect(html).toContain('grid-thumb-file')
    expect(html).toContain('application/pdf')
  })

  it('shows view toggle for upload collections', () => {
    const html = renderListView({
      col: mediaCol,
      docs: [{ id: '1', alt: 'Test' }]
    })
    expect(html).toContain('view-toggle')
    expect(html).toContain('Table')
    expect(html).toContain('Grid')
  })

  it('does NOT show view toggle for non-upload collections', () => {
    const html = renderListView({
      col: normalCol,
      docs: [{ id: '1', title: 'Test' }]
    })
    expect(html).not.toContain('view-toggle')
  })

  it('marks current view mode as active', () => {
    const html = renderListView({
      col: mediaCol,
      docs: [{ id: '1', alt: 'Test' }],
      viewMode: 'grid'
    })
    expect(html).toContain('view-toggle-active')
  })
})
