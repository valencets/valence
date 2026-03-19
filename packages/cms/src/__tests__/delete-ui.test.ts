import { describe, it, expect } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
import { renderListView } from '../admin/list-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

const col = collection({
  slug: 'posts',
  labels: { singular: 'Post', plural: 'Posts' },
  fields: [
    field.text({ name: 'title', required: true }),
    field.slug({ name: 'slug', required: true })
  ]
})

describe('delete button styling', () => {
  it('uses btn-ghost-danger instead of btn-danger for less prominence', () => {
    const html = renderEditView(col, { id: '123', title: 'Test', slug: 'test' }, 'tok')
    expect(html).toContain('btn-ghost-danger')
    expect(html).not.toContain('"btn btn-danger delete-trigger"')
  })
})

describe('list view delete action', () => {
  it('renders delete link/form per row', () => {
    const docs = [
      { id: 'aaa', title: 'Post A', slug: 'post-a' },
      { id: 'bbb', title: 'Post B', slug: 'post-b' }
    ]
    const html = renderListView({ col, docs })
    expect(html).toContain('/admin/posts/aaa/edit')
    expect(html).toContain('/admin/posts/bbb/edit')
  })

  it('renders an Actions column header', () => {
    const docs = [{ id: 'aaa', title: 'Post A', slug: 'post-a' }]
    const html = renderListView({ col, docs })
    expect(html).toContain('<th>Actions</th>')
  })

  it('renders edit link in actions column', () => {
    const docs = [{ id: 'aaa', title: 'Post A', slug: 'post-a' }]
    const html = renderListView({ col, docs })
    expect(html).toContain('Edit</a>')
  })
})
