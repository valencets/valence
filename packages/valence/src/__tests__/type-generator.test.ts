import { describe, it, expect } from 'vitest'
import { generateEntityInterface } from '../codegen/type-generator.js'
import { collection, field } from '@valencets/cms'

describe('generateEntityInterface', () => {
  it('generates interface with id and timestamps', () => {
    const col = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title', required: true })]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('// @generated')
    expect(output).toContain('export interface Post {')
    expect(output).toContain('readonly id: string')
    expect(output).toContain('readonly title: string')
    expect(output).toContain('readonly createdAt: string')
    expect(output).toContain('readonly updatedAt: string')
  })

  it('omits timestamps when collection has timestamps: false', () => {
    const col = collection({
      slug: 'tags',
      timestamps: false,
      fields: [field.text({ name: 'name', required: true })]
    })
    const output = generateEntityInterface(col)
    expect(output).not.toContain('createdAt')
    expect(output).not.toContain('updatedAt')
  })

  it('marks optional fields with ?', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.text({ name: 'subtitle' })
      ]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly title: string')
    expect(output).toContain('readonly subtitle?: string')
  })

  it('maps text, textarea, richtext to string', () => {
    const col = collection({
      slug: 'docs',
      fields: [
        field.text({ name: 'a', required: true }),
        field.textarea({ name: 'b', required: true }),
        field.richtext({ name: 'c', required: true })
      ]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly a: string')
    expect(output).toContain('readonly b: string')
    expect(output).toContain('readonly c: string')
  })

  it('maps number to number', () => {
    const col = collection({
      slug: 'items',
      fields: [field.number({ name: 'count', required: true })]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly count: number')
  })

  it('maps boolean to boolean', () => {
    const col = collection({
      slug: 'items',
      fields: [field.boolean({ name: 'active', required: true })]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly active: boolean')
  })

  it('maps select to literal union', () => {
    const col = collection({
      slug: 'items',
      fields: [field.select({
        name: 'status',
        required: true,
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' }
        ]
      })]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain("readonly status: 'draft' | 'published'")
  })

  it('maps multiselect to array of literal union', () => {
    const col = collection({
      slug: 'items',
      fields: [field.multiselect({
        name: 'tags',
        required: true,
        options: [
          { label: 'A', value: 'a' },
          { label: 'B', value: 'b' }
        ]
      })]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain("readonly tags: Array<'a' | 'b'>")
  })

  it('maps date, slug, email, url, password, json, color to string', () => {
    const col = collection({
      slug: 'items',
      fields: [
        field.date({ name: 'a', required: true }),
        field.slug({ name: 'b', required: true }),
        field.email({ name: 'c', required: true }),
        field.url({ name: 'd', required: true }),
        field.password({ name: 'e', required: true }),
        field.json({ name: 'f', required: true }),
        field.color({ name: 'g', required: true })
      ]
    })
    const output = generateEntityInterface(col)
    for (const name of ['a', 'b', 'c', 'd', 'e', 'f', 'g']) {
      expect(output).toContain(`readonly ${name}: string`)
    }
  })

  it('maps media and relation to string', () => {
    const col = collection({
      slug: 'items',
      fields: [
        field.media({ name: 'image', required: true, relationTo: 'media' }),
        field.relation({ name: 'author', required: true, relationTo: 'users' })
      ]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly image: string')
    expect(output).toContain('readonly author: string')
  })

  it('maps hasMany relation to string[]', () => {
    const col = collection({
      slug: 'items',
      fields: [
        field.relation({ name: 'tags', required: true, relationTo: 'tags', hasMany: true })
      ]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly tags: string[]')
  })

  it('maps group to nested object type', () => {
    const col = collection({
      slug: 'pages',
      fields: [field.group({
        name: 'seo',
        required: true,
        fields: [
          field.text({ name: 'metaTitle', required: true }),
          field.text({ name: 'metaDescription' })
        ]
      })]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly seo: {')
    expect(output).toContain('readonly metaTitle: string')
    expect(output).toContain('readonly metaDescription?: string')
  })

  it('maps array to Array of nested object type', () => {
    const col = collection({
      slug: 'pages',
      fields: [field.array({
        name: 'blocks',
        required: true,
        fields: [
          field.text({ name: 'type', required: true }),
          field.text({ name: 'content' })
        ]
      })]
    })
    const output = generateEntityInterface(col)
    expect(output).toContain('readonly blocks: Array<{')
    expect(output).toContain('readonly type: string')
    expect(output).toContain('readonly content?: string')
  })

  it('singularizes plural slugs correctly', () => {
    expect(generateEntityInterface(collection({
      slug: 'categories', fields: []
    }))).toContain('interface Category')

    expect(generateEntityInterface(collection({
      slug: 'addresses', fields: []
    }))).toContain('interface Address')

    expect(generateEntityInterface(collection({
      slug: 'posts', fields: []
    }))).toContain('interface Post')
  })

  it('handles hyphenated slugs with PascalCase', () => {
    const col = collection({ slug: 'blog-posts', fields: [] })
    const output = generateEntityInterface(col)
    expect(output).toContain('interface BlogPost')
  })
})

describe('generateApiClient', () => {
  it('generates typed client with correct import', async () => {
    const { generateApiClient } = await import('../codegen/api-client-generator.js')
    const col = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title', required: true })]
    })
    const output = generateApiClient(col)
    expect(output).toContain('// @generated')
    expect(output).toContain("import type { Post } from '../model/types.js'")
    expect(output).toContain("apiClient<Post>('/api/posts')")
    expect(output).toContain('export const posts')
  })
})

describe('generateBaseClient', () => {
  it('generates base client with CRUD methods', async () => {
    const { generateBaseClient } = await import('../codegen/base-client-generator.js')
    const output = generateBaseClient()
    expect(output).toContain('// @generated')
    expect(output).toContain('export function apiClient')
    expect(output).toContain('list')
    expect(output).toContain('get')
    expect(output).toContain('create')
    expect(output).toContain('update')
    expect(output).toContain('remove')
  })
})
