import { describe, it, expect } from 'vitest'
import { nestedDocsPlugin } from '../nested-docs-plugin.js'
import type { CmsConfig } from '@valencets/cms'
import type { RelationFieldConfig, JsonFieldConfig } from '@valencets/cms'

const makeConfig = (collections: CmsConfig['collections']): CmsConfig => ({
  db: {} as CmsConfig['db'],
  secret: 'test-secret',
  collections
})

describe('nestedDocsPlugin', () => {
  describe('field injection', () => {
    it('injects a parent relation field into targeted collections', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const parentField = pages?.fields.find(f => f.name === 'parent')
      expect(parentField).toBeDefined()
      expect(parentField?.type).toBe('relation')
    })

    it('parent field uses self-referencing relationTo (collection slug)', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const parentField = pages?.fields.find(f => f.name === 'parent') as RelationFieldConfig | undefined
      expect(parentField?.relationTo).toBe('pages')
    })

    it('uses custom parentField name when provided', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'], parentField: 'parentPage' })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const parentField = pages?.fields.find(f => f.name === 'parentPage')
      expect(parentField).toBeDefined()
      expect(parentField?.type).toBe('relation')
    })

    it('injects a breadcrumbs JSON field into targeted collections', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const breadcrumbsField = pages?.fields.find(f => f.name === 'breadcrumbs')
      expect(breadcrumbsField).toBeDefined()
      expect(breadcrumbsField?.type).toBe('json')
    })

    it('uses custom breadcrumbField name when provided', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'], breadcrumbField: 'trail' })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const trailField = pages?.fields.find(f => f.name === 'trail') as JsonFieldConfig | undefined
      expect(trailField).toBeDefined()
      expect(trailField?.type).toBe('json')
    })
  })

  describe('collection filtering', () => {
    it('only injects into specified collections', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] },
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pagesParent = result.collections.find(c => c.slug === 'pages')?.fields.find(f => f.name === 'parent')
      const postsParent = result.collections.find(c => c.slug === 'posts')?.fields.find(f => f.name === 'parent')
      expect(pagesParent).toBeDefined()
      expect(postsParent).toBeUndefined()
    })

    it('does not modify non-targeted collections', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [] },
        { slug: 'posts', timestamps: true, fields: [] }
      ])
      const originalPosts = config.collections.find(c => c.slug === 'posts')
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const updatedPosts = result.collections.find(c => c.slug === 'posts')
      expect(updatedPosts).toBe(originalPosts)
    })
  })

  describe('afterChange hook for breadcrumbs', () => {
    it('adds afterChange hook to targeted collections', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      expect(pages?.hooks?.afterChange).toBeDefined()
      expect(pages?.hooks?.afterChange?.length).toBeGreaterThan(0)
    })

    it('afterChange hook sets breadcrumbs with current doc when no parent', async () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const hook = pages?.hooks?.afterChange?.[0]
      const hookResult = await hook?.({
        data: { title: 'Home', parent: null },
        id: 'doc-1',
        collection: 'pages'
      })
      const breadcrumbs = hookResult?.['breadcrumbs']
      expect(typeof breadcrumbs).toBe('string')
      const parsed = JSON.parse(String(breadcrumbs))
      expect(Array.isArray(parsed)).toBe(true)
      expect(parsed).toHaveLength(1)
      expect(parsed[0]).toMatchObject({ id: 'doc-1', label: 'Home' })
    })

    it('afterChange hook sets breadcrumbs with label from title when no parent', async () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const hook = pages?.hooks?.afterChange?.[0]
      const hookResult = await hook?.({
        data: { title: 'About Us', parent: null },
        id: 'doc-2',
        collection: 'pages'
      })
      const breadcrumbs = hookResult?.['breadcrumbs']
      const parsed = JSON.parse(String(breadcrumbs))
      expect(parsed[0]).toMatchObject({ label: 'About Us' })
    })

    it('preserves existing afterChange hooks', () => {
      const existingHook = async ({ data }: { data: Record<string, string | number | boolean | null | readonly string[] | readonly number[] | undefined> }) => ({ ...data, processed: true })
      const config = makeConfig([
        {
          slug: 'pages',
          timestamps: true,
          fields: [{ type: 'text', name: 'title' }],
          hooks: { afterChange: [existingHook] }
        }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      expect(pages?.hooks?.afterChange?.length).toBeGreaterThanOrEqual(2)
    })
  })

  describe('labelField option', () => {
    it('uses "title" as default label field', async () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const hook = pages?.hooks?.afterChange?.[0]
      const hookResult = await hook?.({
        data: { title: 'My Page', name: 'other-field' },
        id: 'doc-3',
        collection: 'pages'
      })
      const parsed = JSON.parse(String(hookResult?.['breadcrumbs']))
      expect(parsed[0]).toMatchObject({ label: 'My Page' })
    })

    it('uses custom labelField when provided', async () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'name' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'], labelField: 'name' })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const hook = pages?.hooks?.afterChange?.[0]
      const hookResult = await hook?.({
        data: { name: 'Custom Label', title: 'ignored' },
        id: 'doc-4',
        collection: 'pages'
      })
      const parsed = JSON.parse(String(hookResult?.['breadcrumbs']))
      expect(parsed[0]).toMatchObject({ label: 'Custom Label' })
    })

    it('falls back to empty string when labelField value is null', async () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      const hook = pages?.hooks?.afterChange?.[0]
      const hookResult = await hook?.({
        data: { title: null },
        id: 'doc-5',
        collection: 'pages'
      })
      const parsed = JSON.parse(String(hookResult?.['breadcrumbs']))
      expect(parsed[0]).toMatchObject({ label: '' })
    })
  })

  describe('idempotency', () => {
    it('does not inject parent/breadcrumbs fields twice when plugin is applied twice', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const plugin = nestedDocsPlugin({ collections: ['pages'] })
      const once = plugin(config)
      const twice = plugin(once)
      const pages = twice.collections.find(c => c.slug === 'pages')
      const parentFields = pages?.fields.filter(f => f.name === 'parent')
      const breadcrumbFields = pages?.fields.filter(f => f.name === 'breadcrumbs')
      expect(parentFields?.length).toBe(1)
      expect(breadcrumbFields?.length).toBe(1)
    })

    it('does not add duplicate afterChange hooks when plugin is applied twice', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const plugin = nestedDocsPlugin({ collections: ['pages'] })
      const once = plugin(config)
      const twice = plugin(once)
      const pages = twice.collections.find(c => c.slug === 'pages')
      expect(pages?.hooks?.afterChange?.length).toBe(1)
    })
  })

  describe('backward compatibility', () => {
    it('preserves existing fields', () => {
      const config = makeConfig([
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }, { type: 'textarea', name: 'body' }] }
      ])
      const result = nestedDocsPlugin({ collections: ['pages'] })(config)
      const pages = result.collections.find(c => c.slug === 'pages')
      expect(pages?.fields.find(f => f.name === 'title')).toBeDefined()
      expect(pages?.fields.find(f => f.name === 'body')).toBeDefined()
    })
  })
})
