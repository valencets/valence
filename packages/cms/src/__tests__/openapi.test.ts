import { describe, it, expect } from 'vitest'
import { generateOpenApiSpec } from '../api/openapi.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'

function makeRegistry (...collections: ReturnType<typeof collection>[]) {
  const registry = createCollectionRegistry()
  for (const col of collections) {
    const result = registry.register(col)
    if (result.isErr()) throw new Error(result.error.message)
  }
  return registry
}

describe('generateOpenApiSpec()', () => {
  it('returns valid OpenAPI 3.0 structure', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title', required: true })] })
    )

    const spec = generateOpenApiSpec(registry)

    expect(spec.openapi).toBe('3.0.3')
    expect(spec.info.title).toBe('Valence CMS API')
    expect(spec.info.version).toBe('1.0.0')
    expect(spec.components.securitySchemes.cookieAuth).toEqual({
      type: 'apiKey',
      in: 'cookie',
      name: 'cms_session'
    })
  })

  it('generates paths for each collection', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title' })] }),
      collection({ slug: 'pages', fields: [field.text({ name: 'heading' })] })
    )

    const spec = generateOpenApiSpec(registry)

    expect(spec.paths['/api/posts']).toBeDefined()
    expect(spec.paths['/api/posts/{id}']).toBeDefined()
    expect(spec.paths['/api/pages']).toBeDefined()
    expect(spec.paths['/api/pages/{id}']).toBeDefined()
  })

  it('generates CRUD operations for list path', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
    )

    const spec = generateOpenApiSpec(registry)
    const listPath = spec.paths['/api/posts']

    expect(listPath?.get).toBeDefined()
    expect(listPath?.get?.summary).toBe('List posts')
    expect(listPath?.get?.tags).toEqual(['posts'])

    expect(listPath?.post).toBeDefined()
    expect(listPath?.post?.summary).toBe('Create posts')
  })

  it('generates CRUD operations for item path', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
    )

    const spec = generateOpenApiSpec(registry)
    const itemPath = spec.paths['/api/posts/{id}']

    expect(itemPath?.get).toBeDefined()
    expect(itemPath?.get?.summary).toBe('Get posts by ID')

    expect(itemPath?.patch).toBeDefined()
    expect(itemPath?.patch?.summary).toBe('Update posts')

    expect(itemPath?.delete).toBeDefined()
    expect(itemPath?.delete?.summary).toBe('Delete posts')
  })

  it('includes security requirement on all operations', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
    )

    const spec = generateOpenApiSpec(registry)
    const listPath = spec.paths['/api/posts']
    const itemPath = spec.paths['/api/posts/{id}']

    const expectedSecurity = [{ cookieAuth: [] }]

    expect(listPath?.get?.security).toEqual(expectedSecurity)
    expect(listPath?.post?.security).toEqual(expectedSecurity)
    expect(itemPath?.get?.security).toEqual(expectedSecurity)
    expect(itemPath?.patch?.security).toEqual(expectedSecurity)
    expect(itemPath?.delete?.security).toEqual(expectedSecurity)
  })

  it('includes pagination parameters on list endpoint', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
    )

    const spec = generateOpenApiSpec(registry)
    const listOp = spec.paths['/api/posts']?.get
    const params = listOp?.parameters

    expect(params).toBeDefined()
    expect(params).toHaveLength(2)

    const pageParam = params?.find(p => p.name === 'page')
    expect(pageParam?.in).toBe('query')
    expect(pageParam?.schema.type).toBe('integer')
    expect(pageParam?.schema.default).toBe(1)

    const limitParam = params?.find(p => p.name === 'limit')
    expect(limitParam?.in).toBe('query')
    expect(limitParam?.schema.type).toBe('integer')
    expect(limitParam?.schema.default).toBe(25)
    expect(limitParam?.schema.maximum).toBe(100)
  })

  it('generates paginated response schema', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
    )

    const spec = generateOpenApiSpec(registry)
    const paginatedSchema = spec.components.schemas.postsPaginated

    expect(paginatedSchema).toBeDefined()
    expect(paginatedSchema?.properties).toBeDefined()
    const props = paginatedSchema?.properties as Record<string, Record<string, unknown>>
    expect(props.docs).toBeDefined()
    expect(props.totalDocs).toEqual({ type: 'number' })
    expect(props.page).toEqual({ type: 'number' })
    expect(props.totalPages).toEqual({ type: 'number' })
    expect(props.hasNextPage).toEqual({ type: 'boolean' })
    expect(props.hasPrevPage).toEqual({ type: 'boolean' })
    expect(paginatedSchema?.required).toEqual(
      ['docs', 'totalDocs', 'page', 'totalPages', 'hasNextPage', 'hasPrevPage']
    )
  })

  describe('field type mapping', () => {
    it('maps text fields to string', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.text({ name: 'title' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const schema = spec.components.schemas.items
      const props = schema?.properties as Record<string, Record<string, unknown>>

      expect(props.title).toEqual({ type: 'string' })
    })

    it('maps textarea fields to string', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.textarea({ name: 'body' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.body).toEqual({ type: 'string' })
    })

    it('maps richtext fields to string', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.richtext({ name: 'content' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.content).toEqual({ type: 'string' })
    })

    it('maps number fields to number', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.number({ name: 'count' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.count).toEqual({ type: 'number' })
    })

    it('maps decimal number fields to number with double format', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.number({ name: 'price', hasDecimals: true })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.price).toEqual({ type: 'number', format: 'double' })
    })

    it('maps boolean fields to boolean', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.boolean({ name: 'active' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.active).toEqual({ type: 'boolean' })
    })

    it('maps date fields to string with date-time format', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.date({ name: 'publishedAt' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.publishedAt).toEqual({ type: 'string', format: 'date-time' })
    })

    it('maps email fields to string with email format', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.email({ name: 'email' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.email).toEqual({ type: 'string', format: 'email' })
    })

    it('maps url fields to string with uri format', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.url({ name: 'website' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.website).toEqual({ type: 'string', format: 'uri' })
    })

    it('maps slug fields to string', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.slug({ name: 'slug' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.slug).toEqual({ type: 'string' })
    })

    it('maps color fields to string', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.color({ name: 'theme' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.theme).toEqual({ type: 'string' })
    })

    it('maps media fields to string with uuid format', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.media({ name: 'image', relationTo: 'media' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.image).toEqual({ type: 'string', format: 'uuid' })
    })

    it('maps relation fields to string with uuid format', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.relation({ name: 'author', relationTo: 'users' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.author).toEqual({ type: 'string', format: 'uuid' })
    })

    it('maps hasMany relation fields to array of uuids', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.relation({ name: 'tags', relationTo: 'tags', hasMany: true })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.tags).toEqual({ type: 'array', items: { type: 'string', format: 'uuid' } })
    })

    it('maps select fields with enum values', () => {
      const registry = makeRegistry(
        collection({
          slug: 'items',
          fields: [field.select({
            name: 'status',
            options: [
              { label: 'Draft', value: 'draft' },
              { label: 'Published', value: 'published' }
            ]
          })]
        })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.status).toEqual({ type: 'string', enum: ['draft', 'published'] })
    })

    it('maps multiselect fields to array with enum items', () => {
      const registry = makeRegistry(
        collection({
          slug: 'items',
          fields: [field.multiselect({
            name: 'categories',
            options: [
              { label: 'Tech', value: 'tech' },
              { label: 'News', value: 'news' }
            ]
          })]
        })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.categories).toEqual({
        type: 'array',
        items: { type: 'string', enum: ['tech', 'news'] }
      })
    })

    it('maps json fields to object', () => {
      const registry = makeRegistry(
        collection({ slug: 'items', fields: [field.json({ name: 'metadata' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.metadata).toEqual({ type: 'object', additionalProperties: true })
    })

    it('maps group fields to nested object', () => {
      const registry = makeRegistry(
        collection({
          slug: 'items',
          fields: [field.group({
            name: 'seo',
            fields: [
              field.text({ name: 'metaTitle' }),
              field.text({ name: 'metaDescription' })
            ]
          })]
        })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.seo).toEqual({
        type: 'object',
        properties: {
          metaTitle: { type: 'string' },
          metaDescription: { type: 'string' }
        }
      })
    })

    it('maps array fields to array of objects with nested fields', () => {
      const registry = makeRegistry(
        collection({
          slug: 'items',
          fields: [field.array({
            name: 'links',
            fields: [
              field.text({ name: 'label' }),
              field.url({ name: 'href' })
            ]
          })]
        })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.links).toEqual({
        type: 'array',
        items: {
          type: 'object',
          properties: {
            label: { type: 'string' },
            href: { type: 'string', format: 'uri' }
          }
        }
      })
    })

    it('maps blocks fields to array of objects', () => {
      const registry = makeRegistry(
        collection({
          slug: 'items',
          fields: [field.blocks({
            name: 'layout',
            blocks: [
              { slug: 'hero', fields: [field.text({ name: 'heading' })] },
              { slug: 'cta', fields: [field.text({ name: 'label' })] }
            ]
          })]
        })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

      expect(props.layout).toEqual({
        type: 'array',
        items: {
          type: 'object',
          description: 'Block content — one of: hero, cta'
        }
      })
    })

    it('excludes password fields from output schema', () => {
      const registry = makeRegistry(
        collection({
          slug: 'users',
          fields: [
            field.text({ name: 'name' }),
            field.password({ name: 'hash' })
          ]
        })
      )
      const spec = generateOpenApiSpec(registry)
      const outputProps = spec.components.schemas.users?.properties as Record<string, Record<string, unknown>>

      expect(outputProps.name).toBeDefined()
      expect(outputProps.hash).toBeUndefined()
    })

    it('includes password fields in input schema', () => {
      const registry = makeRegistry(
        collection({
          slug: 'users',
          fields: [
            field.text({ name: 'name' }),
            field.password({ name: 'hash' })
          ]
        })
      )
      const spec = generateOpenApiSpec(registry)
      const inputProps = spec.components.schemas.usersInput?.properties as Record<string, Record<string, unknown>>

      expect(inputProps.name).toBeDefined()
      expect(inputProps.hash).toEqual({ type: 'string' })
    })
  })

  describe('schema structure', () => {
    it('includes id in output schema', () => {
      const registry = makeRegistry(
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.posts?.properties as Record<string, Record<string, unknown>>

      expect(props.id).toEqual({ type: 'string', format: 'uuid' })
      expect(spec.components.schemas.posts?.required).toContain('id')
    })

    it('includes timestamps when collection has timestamps', () => {
      const registry = makeRegistry(
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.posts?.properties as Record<string, Record<string, unknown>>

      expect(props.createdAt).toEqual({ type: 'string', format: 'date-time' })
      expect(props.updatedAt).toEqual({ type: 'string', format: 'date-time' })
    })

    it('excludes timestamps when collection does not have them', () => {
      const registry = makeRegistry(
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })], timestamps: false })
      )
      const spec = generateOpenApiSpec(registry)
      const props = spec.components.schemas.posts?.properties as Record<string, Record<string, unknown>>

      expect(props.createdAt).toBeUndefined()
      expect(props.updatedAt).toBeUndefined()
    })

    it('marks required fields in output schema', () => {
      const registry = makeRegistry(
        collection({
          slug: 'posts',
          fields: [
            field.text({ name: 'title', required: true }),
            field.text({ name: 'subtitle' })
          ]
        })
      )
      const spec = generateOpenApiSpec(registry)

      expect(spec.components.schemas.posts?.required).toContain('id')
      expect(spec.components.schemas.posts?.required).toContain('title')
      expect(spec.components.schemas.posts?.required).not.toContain('subtitle')
    })

    it('marks required fields in input schema', () => {
      const registry = makeRegistry(
        collection({
          slug: 'posts',
          fields: [
            field.text({ name: 'title', required: true }),
            field.text({ name: 'subtitle' })
          ]
        })
      )
      const spec = generateOpenApiSpec(registry)

      expect(spec.components.schemas.postsInput?.required).toContain('title')
      expect(spec.components.schemas.postsInput?.required).not.toContain('subtitle')
    })

    it('does not include id in input schema', () => {
      const registry = makeRegistry(
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const inputProps = spec.components.schemas.postsInput?.properties as Record<string, Record<string, unknown>>

      expect(inputProps.id).toBeUndefined()
    })

    it('does not include timestamps in input schema', () => {
      const registry = makeRegistry(
        collection({ slug: 'posts', fields: [field.text({ name: 'title' })] })
      )
      const spec = generateOpenApiSpec(registry)
      const inputProps = spec.components.schemas.postsInput?.properties as Record<string, Record<string, unknown>>

      expect(inputProps.createdAt).toBeUndefined()
      expect(inputProps.updatedAt).toBeUndefined()
    })
  })

  it('flattens layout fields (tabs, rows, collapsible)', () => {
    const registry = makeRegistry(
      collection({
        slug: 'items',
        fields: [
          field.tabs({
            name: 'layout',
            tabs: [
              { label: 'Content', fields: [field.text({ name: 'title' })] },
              { label: 'Meta', fields: [field.text({ name: 'description' })] }
            ]
          })
        ]
      })
    )
    const spec = generateOpenApiSpec(registry)
    const props = spec.components.schemas.items?.properties as Record<string, Record<string, unknown>>

    expect(props.title).toEqual({ type: 'string' })
    expect(props.description).toEqual({ type: 'string' })
    expect(props.layout).toBeUndefined()
  })

  it('uses collection labels when available', () => {
    const registry = makeRegistry(
      collection({
        slug: 'posts',
        labels: { singular: 'Blog Post', plural: 'Blog Posts' },
        fields: [field.text({ name: 'title' })]
      })
    )
    const spec = generateOpenApiSpec(registry)
    const listOp = spec.paths['/api/posts']?.get

    expect(listOp?.summary).toBe('List Blog Posts')
  })

  it('generates schemas for multiple collections', () => {
    const registry = makeRegistry(
      collection({ slug: 'posts', fields: [field.text({ name: 'title' })] }),
      collection({ slug: 'pages', fields: [field.text({ name: 'heading' }), field.number({ name: 'order' })] })
    )
    const spec = generateOpenApiSpec(registry)

    expect(spec.components.schemas.posts).toBeDefined()
    expect(spec.components.schemas.postsInput).toBeDefined()
    expect(spec.components.schemas.postsPaginated).toBeDefined()
    expect(spec.components.schemas.pages).toBeDefined()
    expect(spec.components.schemas.pagesInput).toBeDefined()
    expect(spec.components.schemas.pagesPaginated).toBeDefined()

    const pagesProps = spec.components.schemas.pages?.properties as Record<string, Record<string, unknown>>
    expect(pagesProps.heading).toEqual({ type: 'string' })
    expect(pagesProps.order).toEqual({ type: 'number' })
  })

  it('produces valid JSON-serializable output', () => {
    const registry = makeRegistry(
      collection({
        slug: 'posts',
        fields: [
          field.text({ name: 'title', required: true }),
          field.number({ name: 'views' }),
          field.boolean({ name: 'published' }),
          field.date({ name: 'createdAt' }),
          field.select({ name: 'status', options: [{ label: 'Draft', value: 'draft' }] })
        ]
      })
    )
    const spec = generateOpenApiSpec(registry)
    const json = JSON.stringify(spec)
    const parsed = JSON.parse(json)

    expect(parsed.openapi).toBe('3.0.3')
    expect(parsed.paths['/api/posts']).toBeDefined()
  })

  it('handles empty collection registry', () => {
    const registry = createCollectionRegistry()
    const spec = generateOpenApiSpec(registry)

    expect(spec.openapi).toBe('3.0.3')
    expect(Object.keys(spec.paths)).toHaveLength(0)
    expect(Object.keys(spec.components.schemas)).toHaveLength(0)
  })
})
