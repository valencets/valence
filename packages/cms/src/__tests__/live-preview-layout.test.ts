import { describe, it, expect } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

const postsWithStringPreview = collection({
  slug: 'posts',
  fields: [
    field.text({ name: 'title' }),
    field.text({ name: 'slug' })
  ],
  admin: {
    preview: '/posts/[slug]'
  }
})

const postsWithFnPreview = collection({
  slug: 'posts',
  fields: [
    field.text({ name: 'title' }),
    field.text({ name: 'slug' })
  ],
  admin: {
    preview: (doc: Record<string, string>) => `/preview/${doc['slug'] ?? 'draft'}`
  }
})

const postsWithoutPreview = collection({
  slug: 'posts',
  fields: [
    field.text({ name: 'title' }),
    field.text({ name: 'slug' })
  ]
})

describe('renderEditView — split-pane layout with preview', () => {
  it('renders split-pane container when admin.preview is configured (string)', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('edit-split-pane')
  })

  it('renders split-pane container when admin.preview is configured (function)', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithFnPreview, doc)
    expect(html).toContain('edit-split-pane')
  })

  it('does NOT render split-pane when no preview configured', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithoutPreview, doc)
    expect(html).not.toContain('edit-split-pane')
  })

  it('renders preview iframe with class preview-iframe', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('class="preview-iframe"')
  })

  it('sets iframe src from string pattern — replaces [slug] with doc value', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello-world' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('src="/posts/hello-world"')
  })

  it('sets iframe src from function — calls function with doc data', () => {
    const doc = { id: '1', title: 'Hello', slug: 'my-post' }
    const html = renderEditView(postsWithFnPreview, doc)
    expect(html).toContain('src="/preview/my-post"')
  })

  it('renders preview toolbar with refresh button', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('preview-refresh')
  })

  it('renders viewport switcher buttons', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('data-viewport="desktop"')
    expect(html).toContain('data-viewport="tablet"')
    expect(html).toContain('data-viewport="mobile"')
  })

  it('still renders form fields in split-pane layout', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('name="title"')
    expect(html).toContain('name="slug"')
  })

  it('uses empty string for preview URL when doc is null (new document) with string pattern', () => {
    const html = renderEditView(postsWithStringPreview, null)
    expect(html).toContain('class="preview-iframe"')
    // Should still render iframe but with empty/fallback src
    expect(html).toContain('src=')
  })

  it('renders left-pane class for form area', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('preview-left')
  })

  it('renders right-pane class for preview area', () => {
    const doc = { id: '1', title: 'Hello', slug: 'hello' }
    const html = renderEditView(postsWithStringPreview, doc)
    expect(html).toContain('preview-right')
  })
})
