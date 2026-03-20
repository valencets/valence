import { describe, it, expect } from 'vitest'
import { validateCollections } from '../validate-collections.js'
import type { CollectionConfig } from '@valencets/cms'

const makeCollection = (overrides: Partial<CollectionConfig> = {}): CollectionConfig => ({
  slug: 'posts',
  fields: [
    { type: 'text', name: 'title' }
  ],
  timestamps: true,
  ...overrides
})

describe('validateCollections', () => {
  describe('slug format validation', () => {
    it('accepts a valid lowercase slug', () => {
      const result = validateCollections([makeCollection({ slug: 'posts' })])
      expect(result.isOk()).toBe(true)
    })

    it('accepts a slug with hyphens', () => {
      const result = validateCollections([makeCollection({ slug: 'blog-posts' })])
      expect(result.isOk()).toBe(true)
    })

    it('accepts a slug with numbers after first letter', () => {
      const result = validateCollections([makeCollection({ slug: 'posts2' })])
      expect(result.isOk()).toBe(true)
    })

    it('rejects a slug with uppercase letters', () => {
      const result = validateCollections([makeCollection({ slug: 'Posts' })])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
        expect(result.error.message).toContain('Posts')
      }
    })

    it('rejects a slug with spaces', () => {
      const result = validateCollections([makeCollection({ slug: 'blog posts' })])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
      }
    })

    it('rejects a slug with special characters', () => {
      const result = validateCollections([makeCollection({ slug: 'blog_posts' })])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
      }
    })

    it('rejects a slug starting with a number', () => {
      const result = validateCollections([makeCollection({ slug: '1posts' })])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
      }
    })

    it('rejects a slug starting with a hyphen', () => {
      const result = validateCollections([makeCollection({ slug: '-posts' })])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
      }
    })

    it('rejects an empty slug', () => {
      const result = validateCollections([makeCollection({ slug: '' })])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
      }
    })
  })

  describe('duplicate slug validation', () => {
    it('accepts multiple collections with unique slugs', () => {
      const result = validateCollections([
        makeCollection({ slug: 'posts' }),
        makeCollection({ slug: 'pages' })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('rejects duplicate slugs across collections', () => {
      const result = validateCollections([
        makeCollection({ slug: 'posts' }),
        makeCollection({ slug: 'posts' })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('DUPLICATE_COLLECTION_SLUG')
        expect(result.error.message).toContain('posts')
      }
    })

    it('rejects multiple sets of duplicates and reports the first', () => {
      const result = validateCollections([
        makeCollection({ slug: 'posts' }),
        makeCollection({ slug: 'posts' }),
        makeCollection({ slug: 'pages' }),
        makeCollection({ slug: 'pages' })
      ])
      expect(result.isErr()).toBe(true)
    })
  })

  describe('slugFrom field reference validation', () => {
    it('accepts a slugFrom referencing an existing field name', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'posts',
          fields: [
            { type: 'text', name: 'title' },
            { type: 'slug', name: 'slug', slugFrom: 'title' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('accepts a slug field without slugFrom', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'posts',
          fields: [
            { type: 'slug', name: 'slug' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('rejects a slugFrom referencing a non-existent field name', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'posts',
          fields: [
            { type: 'text', name: 'title' },
            { type: 'slug', name: 'slug', slugFrom: 'nonexistent' }
          ]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_SLUG_FROM')
        expect(result.error.message).toContain('nonexistent')
        expect(result.error.message).toContain('posts')
      }
    })

    it('validates slugFrom across multiple collections independently', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'posts',
          fields: [
            { type: 'text', name: 'title' },
            { type: 'slug', name: 'slug', slugFrom: 'title' }
          ]
        }),
        makeCollection({
          slug: 'pages',
          fields: [
            { type: 'text', name: 'name' },
            { type: 'slug', name: 'slug', slugFrom: 'name' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('rejects slugFrom referencing a field from a different collection', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'posts',
          fields: [
            { type: 'text', name: 'title' },
            { type: 'slug', name: 'slug', slugFrom: 'title' }
          ]
        }),
        makeCollection({
          slug: 'pages',
          fields: [
            { type: 'text', name: 'name' },
            { type: 'slug', name: 'slug', slugFrom: 'title' }
          ]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_SLUG_FROM')
        expect(result.error.message).toContain('pages')
      }
    })
  })

  describe('integration with defineConfig', () => {
    it('returns Ok for empty collections array', () => {
      const result = validateCollections([])
      expect(result.isOk()).toBe(true)
    })

    it('checks format before duplicates', () => {
      // Two invalid slugs — should fail with format error (checked first)
      const result = validateCollections([
        makeCollection({ slug: 'Bad Slug' }),
        makeCollection({ slug: 'Bad Slug' })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_COLLECTION_SLUG')
      }
    })
  })

  describe('reserved field name validation', () => {
    it('rejects a field named "id"', () => {
      const result = validateCollections([
        makeCollection({
          fields: [{ type: 'text', name: 'id' }]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('RESERVED_FIELD_NAME')
        expect(result.error.message).toContain('id')
      }
    })

    it('rejects a field named "created_at"', () => {
      const result = validateCollections([
        makeCollection({
          fields: [{ type: 'text', name: 'created_at' }]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('RESERVED_FIELD_NAME')
        expect(result.error.message).toContain('created_at')
      }
    })

    it('rejects a field named "updated_at"', () => {
      const result = validateCollections([
        makeCollection({
          fields: [{ type: 'text', name: 'updated_at' }]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('RESERVED_FIELD_NAME')
      }
    })

    it('rejects a field named "deleted_at"', () => {
      const result = validateCollections([
        makeCollection({
          fields: [{ type: 'text', name: 'deleted_at' }]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('RESERVED_FIELD_NAME')
      }
    })

    it('rejects a field named "_status"', () => {
      const result = validateCollections([
        makeCollection({
          fields: [{ type: 'text', name: '_status' }]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('RESERVED_FIELD_NAME')
      }
    })

    it('rejects a field named "publish_at"', () => {
      const result = validateCollections([
        makeCollection({
          fields: [{ type: 'text', name: 'publish_at' }]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('RESERVED_FIELD_NAME')
      }
    })

    it('accepts fields with non-reserved names', () => {
      const result = validateCollections([
        makeCollection({
          fields: [
            { type: 'text', name: 'title' },
            { type: 'text', name: 'body' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('includes the collection slug in the reserved name error message', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'articles',
          fields: [{ type: 'text', name: 'id' }]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('articles')
        expect(result.error.message).toContain('id')
      }
    })
  })

  describe('duplicate field name validation', () => {
    it('rejects duplicate field names within a single collection', () => {
      const result = validateCollections([
        makeCollection({
          fields: [
            { type: 'text', name: 'title' },
            { type: 'text', name: 'title' }
          ]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('DUPLICATE_FIELD_NAME')
        expect(result.error.message).toContain('title')
      }
    })

    it('rejects duplicate field names with different types', () => {
      const result = validateCollections([
        makeCollection({
          fields: [
            { type: 'text', name: 'summary' },
            { type: 'textarea', name: 'summary' }
          ]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('DUPLICATE_FIELD_NAME')
        expect(result.error.message).toContain('summary')
      }
    })

    it('accepts fields with unique names', () => {
      const result = validateCollections([
        makeCollection({
          fields: [
            { type: 'text', name: 'title' },
            { type: 'textarea', name: 'body' },
            { type: 'slug', name: 'slug' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('allows the same field name across different collections', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'posts',
          fields: [{ type: 'text', name: 'title' }]
        }),
        makeCollection({
          slug: 'pages',
          fields: [{ type: 'text', name: 'title' }]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('includes the collection slug in the duplicate field error message', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'articles',
          fields: [
            { type: 'text', name: 'name' },
            { type: 'text', name: 'name' }
          ]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.message).toContain('articles')
        expect(result.error.message).toContain('name')
      }
    })
  })

  describe('relation field relationTo validation', () => {
    it('accepts a relation field pointing to a valid collection slug', () => {
      const result = validateCollections([
        makeCollection({ slug: 'posts' }),
        makeCollection({
          slug: 'comments',
          fields: [
            { type: 'text', name: 'body' },
            { type: 'relation', name: 'post', relationTo: 'posts' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('rejects a relation field pointing to a non-existent collection slug', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'comments',
          fields: [
            { type: 'text', name: 'body' },
            { type: 'relation', name: 'post', relationTo: 'nonexistent' }
          ]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_RELATION_TO')
        expect(result.error.message).toContain('nonexistent')
        expect(result.error.message).toContain('comments')
      }
    })

    it('accepts a self-referencing relation', () => {
      const result = validateCollections([
        makeCollection({
          slug: 'categories',
          fields: [
            { type: 'text', name: 'label' },
            { type: 'relation', name: 'parent', relationTo: 'categories' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })

    it('rejects a relation field in a second collection pointing to a non-existent slug', () => {
      const result = validateCollections([
        makeCollection({ slug: 'posts' }),
        makeCollection({
          slug: 'comments',
          fields: [
            { type: 'relation', name: 'author', relationTo: 'users' }
          ]
        })
      ])
      expect(result.isErr()).toBe(true)
      if (result.isErr()) {
        expect(result.error.code).toBe('INVALID_RELATION_TO')
        expect(result.error.message).toContain('users')
      }
    })

    it('accepts multiple valid relation fields', () => {
      const result = validateCollections([
        makeCollection({ slug: 'users' }),
        makeCollection({ slug: 'posts' }),
        makeCollection({
          slug: 'comments',
          fields: [
            { type: 'text', name: 'body' },
            { type: 'relation', name: 'post', relationTo: 'posts' },
            { type: 'relation', name: 'author', relationTo: 'users' }
          ]
        })
      ])
      expect(result.isOk()).toBe(true)
    })
  })
})
