import { describe, it, expect } from 'vitest'
import { collection } from '../schema/collection.js'
import type { AdminConfig } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { renderLayout } from '../admin/layout.js'
import { renderDashboard } from '../admin/dashboard.js'
import type { DashboardData } from '../admin/dashboard.js'

describe('AdminConfig on collection()', () => {
  it('accepts admin config with group, hidden, and position', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      admin: {
        group: 'Content',
        hidden: false,
        position: 1
      }
    })
    expect(posts.admin?.group).toBe('Content')
    expect(posts.admin?.hidden).toBe(false)
    expect(posts.admin?.position).toBe(1)
  })

  it('admin config is optional (backward compat)', () => {
    const pages = collection({
      slug: 'pages',
      fields: [field.text({ name: 'title' })]
    })
    expect(pages.admin).toBeUndefined()
  })

  it('all three admin properties are independently optional', () => {
    const groupOnly = collection({
      slug: 'a',
      fields: [field.text({ name: 'title' })],
      admin: { group: 'Content' }
    })
    expect(groupOnly.admin?.group).toBe('Content')
    expect(groupOnly.admin?.hidden).toBeUndefined()
    expect(groupOnly.admin?.position).toBeUndefined()

    const hiddenOnly = collection({
      slug: 'b',
      fields: [field.text({ name: 'title' })],
      admin: { hidden: true }
    })
    expect(hiddenOnly.admin?.hidden).toBe(true)
    expect(hiddenOnly.admin?.group).toBeUndefined()
    expect(hiddenOnly.admin?.position).toBeUndefined()

    const positionOnly = collection({
      slug: 'c',
      fields: [field.text({ name: 'title' })],
      admin: { position: 5 }
    })
    expect(positionOnly.admin?.position).toBe(5)
    expect(positionOnly.admin?.group).toBeUndefined()
    expect(positionOnly.admin?.hidden).toBeUndefined()
  })

  it('AdminConfig type is importable', () => {
    const config: AdminConfig = { group: 'Settings', hidden: true, position: 10 }
    expect(config.group).toBe('Settings')
  })
})

describe('sidebar rendering', () => {
  it('groups collections by admin.group under a group heading', () => {
    const collections = [
      collection({
        slug: 'posts',
        fields: [field.text({ name: 'title' })],
        admin: { group: 'Content' }
      }),
      collection({
        slug: 'pages',
        fields: [field.text({ name: 'title' })],
        admin: { group: 'Content' }
      })
    ]
    const html = renderLayout({ title: 'Test', content: '', collections })
    expect(html).toContain('nav-group-heading')
    expect(html).toContain('Content')
    const contentHeadingIdx = html.indexOf('Content</li>')
    const postsIdx = html.indexOf('/admin/posts')
    const pagesIdx = html.indexOf('/admin/pages')
    expect(contentHeadingIdx).toBeLessThan(postsIdx)
    expect(contentHeadingIdx).toBeLessThan(pagesIdx)
  })

  it('excludes hidden collections from sidebar', () => {
    const collections = [
      collection({
        slug: 'posts',
        fields: [field.text({ name: 'title' })]
      }),
      collection({
        slug: 'internal',
        fields: [field.text({ name: 'title' })],
        admin: { hidden: true }
      })
    ]
    const html = renderLayout({ title: 'Test', content: '', collections })
    expect(html).toContain('/admin/posts')
    expect(html).not.toContain('/admin/internal')
  })

  it('sorts collections by admin.position within groups (lower first)', () => {
    const collections = [
      collection({
        slug: 'zebra',
        fields: [field.text({ name: 'title' })],
        admin: { position: 3 }
      }),
      collection({
        slug: 'alpha',
        fields: [field.text({ name: 'title' })],
        admin: { position: 1 }
      }),
      collection({
        slug: 'middle',
        fields: [field.text({ name: 'title' })],
        admin: { position: 2 }
      })
    ]
    const html = renderLayout({ title: 'Test', content: '', collections })
    const alphaIdx = html.indexOf('/admin/alpha')
    const middleIdx = html.indexOf('/admin/middle')
    const zebraIdx = html.indexOf('/admin/zebra')
    expect(alphaIdx).toBeLessThan(middleIdx)
    expect(middleIdx).toBeLessThan(zebraIdx)
  })

  it('renders ungrouped collections separately from grouped ones', () => {
    const collections = [
      collection({
        slug: 'posts',
        fields: [field.text({ name: 'title' })],
        admin: { group: 'Content' }
      }),
      collection({
        slug: 'settings',
        fields: [field.text({ name: 'title' })]
      })
    ]
    const html = renderLayout({ title: 'Test', content: '', collections })
    expect(html).toContain('/admin/posts')
    expect(html).toContain('/admin/settings')
    expect(html).toContain('nav-group-heading')
  })

  it('sorts collections without admin.position after positioned ones', () => {
    const collections = [
      collection({
        slug: 'unpositioned',
        fields: [field.text({ name: 'title' })]
      }),
      collection({
        slug: 'first',
        fields: [field.text({ name: 'title' })],
        admin: { position: 1 }
      })
    ]
    const html = renderLayout({ title: 'Test', content: '', collections })
    const firstIdx = html.indexOf('/admin/first')
    const unpositionedIdx = html.indexOf('/admin/unpositioned')
    expect(firstIdx).toBeLessThan(unpositionedIdx)
  })
})

describe('dashboard stats', () => {
  it('excludes hidden collections from dashboard', () => {
    const data: DashboardData = {
      stats: [
        { slug: 'posts', label: 'Posts', count: 10, recent: [] },
        { slug: 'internal', label: 'Internal', count: 5, recent: [], hidden: true }
      ]
    }
    const html = renderDashboard(data)
    expect(html).toContain('Posts')
    expect(html).not.toContain('Internal')
  })

  it('still shows all non-hidden collections', () => {
    const data: DashboardData = {
      stats: [
        { slug: 'posts', label: 'Posts', count: 10, recent: [] },
        { slug: 'pages', label: 'Pages', count: 3, recent: [] },
        { slug: 'hidden-stuff', label: 'Hidden', count: 1, recent: [], hidden: true }
      ]
    }
    const html = renderDashboard(data)
    expect(html).toContain('Posts')
    expect(html).toContain('Pages')
    expect(html).not.toContain('Hidden')
  })
})
