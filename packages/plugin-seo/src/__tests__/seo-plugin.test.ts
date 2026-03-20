import { describe, it, expect } from 'vitest'
import { seoPlugin } from '../seo-plugin.js'
import type { CmsConfig } from '@valencets/cms'
import type { GroupFieldConfig, TextFieldConfig, TextareaFieldConfig, BooleanFieldConfig } from '@valencets/cms'

const makeConfig = (collections: CmsConfig['collections']): CmsConfig => ({
  db: {} as CmsConfig['db'],
  secret: 'test-secret',
  collections
})

describe('seoPlugin', () => {
  describe('field injection', () => {
    it('injects a group field named "seo" into targeted collections', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const seoGroup = posts?.fields.find(f => f.name === 'seo')
      expect(seoGroup).toBeDefined()
      expect(seoGroup?.type).toBe('group')
    })

    it('seo group contains metaTitle text field with maxLength 60', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const seoGroup = posts?.fields.find(f => f.name === 'seo') as GroupFieldConfig | undefined
      const metaTitle = seoGroup?.fields.find(f => f.name === 'metaTitle') as TextFieldConfig | undefined
      expect(metaTitle).toBeDefined()
      expect(metaTitle?.type).toBe('text')
      expect(metaTitle?.maxLength).toBe(60)
    })

    it('seo group contains metaDescription textarea with maxLength 160', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const seoGroup = posts?.fields.find(f => f.name === 'seo') as GroupFieldConfig | undefined
      const metaDesc = seoGroup?.fields.find(f => f.name === 'metaDescription') as TextareaFieldConfig | undefined
      expect(metaDesc).toBeDefined()
      expect(metaDesc?.type).toBe('textarea')
      expect(metaDesc?.maxLength).toBe(160)
    })

    it('seo group contains ogImage text field', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const seoGroup = posts?.fields.find(f => f.name === 'seo') as GroupFieldConfig | undefined
      const ogImage = seoGroup?.fields.find(f => f.name === 'ogImage')
      expect(ogImage).toBeDefined()
      expect(ogImage?.type).toBe('text')
    })

    it('seo group contains noIndex boolean field', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const seoGroup = posts?.fields.find(f => f.name === 'seo') as GroupFieldConfig | undefined
      const noIndex = seoGroup?.fields.find(f => f.name === 'noIndex') as BooleanFieldConfig | undefined
      expect(noIndex).toBeDefined()
      expect(noIndex?.type).toBe('boolean')
    })
  })

  describe('collection filtering', () => {
    it('injects into all collections when collections is "all"', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] },
        { slug: 'pages', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all' })(config)
      const postsSeo = result.collections.find(c => c.slug === 'posts')?.fields.find(f => f.name === 'seo')
      const pagesSeo = result.collections.find(c => c.slug === 'pages')?.fields.find(f => f.name === 'seo')
      expect(postsSeo).toBeDefined()
      expect(pagesSeo).toBeDefined()
    })

    it('only injects into specified collection slugs', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] },
        { slug: 'users', timestamps: true, fields: [{ type: 'email', name: 'email' }] }
      ])
      const result = seoPlugin({ collections: ['posts'] })(config)
      const postsSeo = result.collections.find(c => c.slug === 'posts')?.fields.find(f => f.name === 'seo')
      const usersSeo = result.collections.find(c => c.slug === 'users')?.fields.find(f => f.name === 'seo')
      expect(postsSeo).toBeDefined()
      expect(usersSeo).toBeUndefined()
    })

    it('does not inject into collections not in the list', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [] },
        { slug: 'pages', timestamps: true, fields: [] },
        { slug: 'media', timestamps: true, fields: [] }
      ])
      const result = seoPlugin({ collections: ['posts', 'pages'] })(config)
      const mediaSeo = result.collections.find(c => c.slug === 'media')?.fields.find(f => f.name === 'seo')
      expect(mediaSeo).toBeUndefined()
    })
  })

  describe('auto-title hook (beforeChange)', () => {
    it('adds beforeChange hook to targeted collections', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all', titleField: 'title' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      expect(posts?.hooks?.beforeChange).toBeDefined()
      expect(posts?.hooks?.beforeChange?.length).toBeGreaterThan(0)
    })

    it('does NOT add afterRead hook (wrong lifecycle)', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all', titleField: 'title' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      expect(posts?.hooks?.afterRead).toBeUndefined()
    })

    it('auto-generates metaTitle from titleField when metaTitle is absent', async () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all', titleField: 'title' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const hook = posts?.hooks?.beforeChange?.[0]
      const hookResult = await hook?.({ data: { title: 'My Post', 'seo.metaTitle': undefined } })
      expect(hookResult?.['seo.metaTitle']).toBe('My Post')
    })

    it('appends metaTitleSuffix to generated title', async () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({
        collections: 'all',
        titleField: 'title',
        defaults: { metaTitleSuffix: ' | My Site' }
      })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const hook = posts?.hooks?.beforeChange?.[0]
      const hookResult = await hook?.({ data: { title: 'My Post', 'seo.metaTitle': undefined } })
      expect(hookResult?.['seo.metaTitle']).toBe('My Post | My Site')
    })

    it('does not override existing metaTitle', async () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const result = seoPlugin({ collections: 'all', titleField: 'title' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      const hook = posts?.hooks?.beforeChange?.[0]
      const hookResult = await hook?.({ data: { title: 'My Post', 'seo.metaTitle': 'Custom Title' } })
      expect(hookResult?.['seo.metaTitle']).toBe('Custom Title')
    })
  })

  describe('idempotency', () => {
    it('does not inject seo group twice when plugin is applied twice', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const plugin = seoPlugin({ collections: 'all' })
      const once = plugin(config)
      const twice = plugin(once)
      const posts = twice.collections.find(c => c.slug === 'posts')
      const seoFields = posts?.fields.filter(f => f.name === 'seo')
      expect(seoFields?.length).toBe(1)
    })

    it('does not add duplicate beforeChange hooks when plugin is applied twice', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] }
      ])
      const plugin = seoPlugin({ collections: 'all', titleField: 'title' })
      const once = plugin(config)
      const twice = plugin(once)
      const posts = twice.collections.find(c => c.slug === 'posts')
      expect(posts?.hooks?.beforeChange?.length).toBe(1)
    })
  })

  describe('backward compatibility', () => {
    it('preserves existing fields on collections', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }, { type: 'textarea', name: 'body' }] }
      ])
      const result = seoPlugin({ collections: 'all' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      expect(posts?.fields.find(f => f.name === 'title')).toBeDefined()
      expect(posts?.fields.find(f => f.name === 'body')).toBeDefined()
    })

    it('preserves existing collection hooks', async () => {
      const existingHook = async ({ data }: { data: Record<string, string | number | boolean | null | readonly string[] | readonly number[] | undefined> }) => ({ ...data, processed: true })
      const config = makeConfig([
        {
          slug: 'posts',
          timestamps: true,
          fields: [{ type: 'text', name: 'title' }],
          hooks: { beforeChange: [existingHook] }
        }
      ])
      const result = seoPlugin({ collections: 'all', titleField: 'title' })(config)
      const posts = result.collections.find(c => c.slug === 'posts')
      expect(posts?.hooks?.beforeChange?.length).toBeGreaterThanOrEqual(2)
    })

    it('does not modify non-targeted collections', () => {
      const config = makeConfig([
        { slug: 'posts', timestamps: true, fields: [{ type: 'text', name: 'title' }] },
        { slug: 'users', timestamps: true, fields: [{ type: 'email', name: 'email' }] }
      ])
      const original = config.collections.find(c => c.slug === 'users')
      const result = seoPlugin({ collections: ['posts'] })(config)
      const updated = result.collections.find(c => c.slug === 'users')
      expect(updated).toBe(original)
    })
  })
})
