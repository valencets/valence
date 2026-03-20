import { describe, it, expect } from 'vitest'
import { renderEditView } from '../admin/edit-view.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import type { CollectionConfig } from '../schema/collection.js'

function makeRichtextCollection (): CollectionConfig {
  return collection({
    slug: 'posts',
    labels: { singular: 'Post', plural: 'Posts' },
    fields: [
      field.text({ name: 'title', required: true }),
      field.richtext({ name: 'body' }),
      field.slug({ name: 'slug' }),
      field.date({ name: 'publishedAt' })
    ]
  })
}

function makeNonRichtextCollection (): CollectionConfig {
  return collection({
    slug: 'tags',
    labels: { singular: 'Tag', plural: 'Tags' },
    fields: [
      field.text({ name: 'name', required: true }),
      field.textarea({ name: 'description' })
    ]
  })
}

function makeRichtextOnlyCollection (): CollectionConfig {
  return collection({
    slug: 'docs',
    labels: { singular: 'Doc', plural: 'Docs' },
    fields: [
      field.richtext({ name: 'content' })
    ]
  })
}

describe('content-first layout: richtext collections', () => {
  it('uses two-column layout when collection has richtext field', () => {
    const html = renderEditView(makeRichtextCollection(), null)
    expect(html).toContain('ghost-layout')
  })

  it('keeps single-column layout for non-richtext collections', () => {
    const html = renderEditView(makeNonRichtextCollection(), null)
    expect(html).not.toContain('ghost-layout')
  })

  it('renders a main content area and a sidebar in two-column layout', () => {
    const html = renderEditView(makeRichtextCollection(), null)
    expect(html).toContain('ghost-main')
    expect(html).toContain('ghost-sidebar')
  })

  it('puts the richtext field in the main content area', () => {
    const html = renderEditView(makeRichtextCollection(), null)
    // richtext-wrap should be inside ghost-main, which comes before ghost-sidebar
    const mainIdx = html.indexOf('ghost-main')
    const sidebarIdx = html.indexOf('ghost-sidebar')
    const richtextIdx = html.indexOf('richtext-editor')
    expect(mainIdx).toBeGreaterThanOrEqual(0)
    expect(sidebarIdx).toBeGreaterThanOrEqual(0)
    expect(richtextIdx).toBeGreaterThan(mainIdx)
    expect(richtextIdx).toBeLessThan(sidebarIdx)
  })

  it('renders the first text field with content-title class in main area', () => {
    const html = renderEditView(makeRichtextCollection(), null)
    expect(html).toContain('content-title')
    // title field should be in ghost-main before ghost-sidebar
    const mainIdx = html.indexOf('ghost-main')
    const sidebarIdx = html.indexOf('ghost-sidebar')
    const titleIdx = html.indexOf('content-title')
    expect(titleIdx).toBeGreaterThan(mainIdx)
    expect(titleIdx).toBeLessThan(sidebarIdx)
  })

  it('puts non-richtext, non-title fields in the sidebar', () => {
    const html = renderEditView(makeRichtextCollection(), null)
    const sidebarIdx = html.indexOf('ghost-sidebar')
    // slug and date fields should appear after sidebar start
    const slugIdx = html.indexOf('name="slug"')
    const dateIdx = html.indexOf('name="publishedAt"')
    expect(slugIdx).toBeGreaterThan(sidebarIdx)
    expect(dateIdx).toBeGreaterThan(sidebarIdx)
  })

  it('renders existing doc values in content-first layout', () => {
    const doc = { id: '1', title: 'My Post', body: '<p>Hello</p>', slug: 'my-post', publishedAt: '2024-01-01' }
    const html = renderEditView(makeRichtextCollection(), doc)
    expect(html).toContain('My Post')
    expect(html).toContain('ghost-layout')
  })

  it('does not break on richtext-only collection (no title field)', () => {
    const html = renderEditView(makeRichtextOnlyCollection(), null)
    // Should still render, may or may not have two-column layout
    expect(html).toContain('richtext-editor')
    expect(html).toContain('form')
  })

  it('form action still correct in two-column layout', () => {
    const html = renderEditView(makeRichtextCollection(), null)
    expect(html).toContain('action="/admin/posts/new"')
  })

  it('form action for existing doc correct in two-column layout', () => {
    const doc = { id: '42', title: 'Hello', body: '', slug: '' }
    const html = renderEditView(makeRichtextCollection(), doc)
    expect(html).toContain('action="/admin/posts/42/edit"')
  })
})
