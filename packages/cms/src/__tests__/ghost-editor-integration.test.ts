import { describe, it, expect } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import type { CollectionConfig } from '../schema/collection.js'

/** A richtext versioned collection simulating a typical blog post */
function makeFullBlogCollection (): CollectionConfig {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.richtext({ name: 'body' }),
      field.slug({ name: 'slug' }),
      field.date({ name: 'publishedAt' }),
      field.select({
        name: 'category',
        options: [
          { label: 'Tech', value: 'tech' },
          { label: 'Life', value: 'life' }
        ]
      }),
      field.boolean({ name: 'featured' })
    ],
    versions: { drafts: true }
  })
}

/** A richtext collection with layout fields in the sidebar */
function makeCollectionWithTabsInSidebar (): CollectionConfig {
  return collection({
    slug: 'articles',
    labels: { singular: 'Article', plural: 'Articles' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.richtext({ name: 'body' }),
      field.tabs({
        name: 'meta',
        tabs: [
          {
            label: 'SEO',
            fields: [
              field.text({ name: 'metaTitle' }),
              field.textarea({ name: 'metaDescription' })
            ]
          },
          {
            label: 'Social',
            fields: [
              field.text({ name: 'ogTitle' })
            ]
          }
        ]
      })
    ]
  })
}

function makeRichtextVersionedNoTitle (): CollectionConfig {
  return collection({
    slug: 'notes',
    labels: { singular: 'Note', plural: 'Notes' },
    fields: [
      field.richtext({ name: 'content' }),
      field.select({
        name: 'visibility',
        options: [
          { label: 'Public', value: 'public' },
          { label: 'Private', value: 'private' }
        ]
      })
    ],
    versions: { drafts: true }
  })
}

describe('ghost editor integration: richtext versioned collection', () => {
  it('renders two-column layout WITH autosave indicator for versioned richtext collection', () => {
    const html = renderEditView(makeFullBlogCollection(), null)
    expect(html).toContain('ghost-layout')
    expect(html).toContain('autosave-indicator')
  })

  it('autosave indicator has correct endpoint for existing doc', () => {
    const doc = { id: '42', title: 'Hello', body: '', slug: '', publishedAt: '', category: '', featured: '' }
    const html = renderEditView(makeFullBlogCollection(), doc)
    expect(html).toContain('/admin/posts/42/autosave')
  })

  it('autosave endpoint is empty for new doc', () => {
    const html = renderEditView(makeFullBlogCollection(), null)
    expect(html).toContain('data-autosave-endpoint="/admin/posts//autosave"')
  })

  it('status badge appears alongside autosave indicator for draft doc', () => {
    const doc = { id: '1', title: 'Post', body: '', slug: '', publishedAt: '', category: '', featured: '', _status: 'draft' }
    const html = renderEditView(makeFullBlogCollection(), doc)
    expect(html).toContain('status-badge')
    expect(html).toContain('autosave-indicator')
    expect(html).toContain('ghost-layout')
  })

  it('sidebar contains non-main fields: slug, date, category, featured', () => {
    const html = renderEditView(makeFullBlogCollection(), null)
    const sidebarIdx = html.indexOf('ghost-sidebar')
    const slugIdx = html.indexOf('name="slug"')
    const dateIdx = html.indexOf('name="publishedAt"')
    const categoryIdx = html.indexOf('name="category"')
    const featuredIdx = html.indexOf('name="featured"')
    expect(slugIdx).toBeGreaterThan(sidebarIdx)
    expect(dateIdx).toBeGreaterThan(sidebarIdx)
    expect(categoryIdx).toBeGreaterThan(sidebarIdx)
    expect(featuredIdx).toBeGreaterThan(sidebarIdx)
  })

  it('title field is content-title in main area and not in sidebar', () => {
    const html = renderEditView(makeFullBlogCollection(), null)
    const mainIdx = html.indexOf('ghost-main')
    const sidebarIdx = html.indexOf('ghost-sidebar')
    const contentTitleIdx = html.indexOf('content-title')
    // content-title should appear in main, not sidebar
    expect(contentTitleIdx).toBeGreaterThan(mainIdx)
    expect(contentTitleIdx).toBeLessThan(sidebarIdx)
    // No second content-title in sidebar
    const secondTitleIdx = html.indexOf('content-title', contentTitleIdx + 1)
    expect(secondTitleIdx === -1 || secondTitleIdx < sidebarIdx).toBe(true)
  })
})

describe('ghost editor integration: layout fields in sidebar', () => {
  it('renders tabs field in sidebar area for richtext collection', () => {
    const html = renderEditView(makeCollectionWithTabsInSidebar(), null)
    expect(html).toContain('ghost-layout')
    const sidebarIdx = html.indexOf('ghost-sidebar')
    const tabsIdx = html.indexOf('tabs-field')
    expect(tabsIdx).toBeGreaterThan(sidebarIdx)
  })

  it('tabs nav buttons appear in sidebar', () => {
    const html = renderEditView(makeCollectionWithTabsInSidebar(), null)
    const sidebarIdx = html.indexOf('ghost-sidebar')
    const tabBtnIdx = html.indexOf('tab-btn')
    expect(tabBtnIdx).toBeGreaterThan(sidebarIdx)
  })
})

describe('ghost editor integration: richtext versioned without title field', () => {
  it('still renders richtext in main area even without title field', () => {
    const html = renderEditView(makeRichtextVersionedNoTitle(), null)
    expect(html).toContain('ghost-layout')
    const mainIdx = html.indexOf('ghost-main')
    const richtextIdx = html.indexOf('richtext-editor')
    expect(richtextIdx).toBeGreaterThan(mainIdx)
  })

  it('non-richtext sidebar fields appear in sidebar', () => {
    const html = renderEditView(makeRichtextVersionedNoTitle(), null)
    const sidebarIdx = html.indexOf('ghost-sidebar')
    const visibilityIdx = html.indexOf('name="visibility"')
    expect(visibilityIdx).toBeGreaterThan(sidebarIdx)
  })

  it('autosave indicator present for versioned collection without title', () => {
    const html = renderEditView(makeRichtextVersionedNoTitle(), null)
    expect(html).toContain('autosave-indicator')
  })
})

describe('ghost editor integration: CSRF token in layout', () => {
  it('CSRF token hidden input is present in ghost layout form', () => {
    const html = renderEditView(makeFullBlogCollection(), null, 'test-csrf-token-123')
    expect(html).toContain('name="_csrf"')
    expect(html).toContain('test-csrf-token-123')
  })

  it('action buttons present in ghost layout form', () => {
    const html = renderEditView(makeFullBlogCollection(), null)
    expect(html).toContain('Save Draft')
    expect(html).toContain('Publish')
  })
})
