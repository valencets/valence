import { describe, it, expect } from 'vitest'
import { collection } from '../schema/collection.js'
import type { AdminConfig } from '../schema/collection.js'
import { field } from '../schema/fields.js'

describe('AdminConfig — preview (string pattern)', () => {
  it('accepts preview as a string URL pattern', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title' }),
        field.text({ name: 'slug' })
      ],
      admin: {
        preview: '/posts/[slug]'
      }
    })
    expect(posts.admin?.preview).toBe('/posts/[slug]')
  })

  it('preserves string preview pattern through collection()', () => {
    const config = collection({
      slug: 'pages',
      fields: [field.text({ name: 'slug' })],
      admin: {
        preview: '/[slug]'
      }
    })
    expect(config.admin?.preview).toBe('/[slug]')
  })
})

describe('AdminConfig — preview (function)', () => {
  it('accepts preview as a function receiving doc data', () => {
    const previewFn = (doc: Record<string, string>): string => `/posts/${doc['slug'] ?? ''}`
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'slug' })],
      admin: {
        preview: previewFn
      }
    })
    expect(typeof posts.admin?.preview).toBe('function')
  })

  it('the preview function receives doc data and returns a URL', () => {
    const previewFn = (doc: Record<string, string>): string => `/preview/${doc['slug'] ?? 'draft'}`
    const posts = collection({
      slug: 'posts',
      fields: [field.text({ name: 'slug' })],
      admin: {
        preview: previewFn
      }
    })
    const fn = posts.admin?.preview
    if (typeof fn === 'function') {
      expect(fn({ slug: 'my-post' })).toBe('/preview/my-post')
    }
  })
})

describe('AdminConfig — backward compatibility without preview', () => {
  it('allows AdminConfig without preview (backward compat)', () => {
    const config = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      admin: {
        group: 'Content'
      }
    })
    expect(config.admin?.preview).toBeUndefined()
  })

  it('allows AdminConfig with no admin at all', () => {
    const config = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })]
    })
    expect(config.admin).toBeUndefined()
  })

  it('AdminConfig type accepts preview string', () => {
    const adminConf: AdminConfig = {
      displayField: 'title',
      preview: '/posts/[slug]'
    }
    expect(adminConf.preview).toBe('/posts/[slug]')
  })

  it('AdminConfig type accepts preview function', () => {
    const fn = (doc: Record<string, string>): string => `/p/${doc['id'] ?? ''}`
    const adminConf: AdminConfig = {
      preview: fn
    }
    expect(typeof adminConf.preview).toBe('function')
  })

  it('AdminConfig type accepts preview undefined', () => {
    const adminConf: AdminConfig = {
      displayField: 'title'
    }
    expect(adminConf.preview).toBeUndefined()
  })
})
