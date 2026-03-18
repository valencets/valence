import { describe, it, expect } from 'vitest'
import { collection } from '../schema/collection.js'
import type { CollectionConfig } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('collection()', () => {
  it('returns a CollectionConfig with slug and fields', () => {
    const pages = collection({
      slug: 'pages',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', slugFrom: 'title' }),
        field.textarea({ name: 'body' })
      ]
    })
    expect(pages.slug).toBe('pages')
    expect(pages.fields).toHaveLength(3)
  })

  it('defaults timestamps to true', () => {
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(posts.timestamps).toBe(true)
  })

  it('allows timestamps to be disabled', () => {
    const logs = collection({
      slug: 'logs',
      fields: [field.text({ name: 'msg' })],
      timestamps: false
    })
    expect(logs.timestamps).toBe(false)
  })

  it('accepts labels', () => {
    const config = collection({
      slug: 'blog-posts',
      labels: { singular: 'Blog Post', plural: 'Blog Posts' },
      fields: [field.text({ name: 'title' })]
    })
    expect(config.labels?.singular).toBe('Blog Post')
    expect(config.labels?.plural).toBe('Blog Posts')
  })

  it('accepts auth flag for user collections', () => {
    const users = collection({
      slug: 'users',
      auth: true,
      fields: [field.text({ name: 'name' })]
    })
    expect(users.auth).toBe(true)
  })

  it('accepts upload flag for media collections', () => {
    const media = collection({
      slug: 'media',
      upload: true,
      fields: [field.text({ name: 'alt' })]
    })
    expect(media.upload).toBe(true)
  })
})

describe('CollectionConfig type', () => {
  it('is assignable from collection() return value', () => {
    const config: CollectionConfig = collection({
      slug: 'articles',
      fields: [
        field.text({ name: 'title' }),
        field.boolean({ name: 'published' }),
        field.select({
          name: 'status',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Live', value: 'live' }
          ]
        }),
        field.group({
          name: 'seo',
          fields: [
            field.text({ name: 'metaTitle' }),
            field.textarea({ name: 'metaDescription' })
          ]
        })
      ]
    })
    expect(config.slug).toBe('articles')
    expect(config.fields).toHaveLength(4)
  })
})
