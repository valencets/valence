import { describe, it, expect } from 'vitest'
import {
  collection,
  global,
  field,
  createCollectionRegistry,
  createGlobalRegistry,
  generateCreateTableSql,
  generateZodSchema,
  CmsErrorCode
} from '@valencets/cms'

// ---------------------------------------------------------------------------
// Collection registry
// ---------------------------------------------------------------------------

describe('CollectionRegistry', () => {
  it('registers a collection and retrieves it by slug', () => {
    const registry = createCollectionRegistry()
    const pages = collection({
      slug: 'pages',
      fields: [field.text({ name: 'title', required: true })]
    })

    const registerResult = registry.register(pages)
    expect(registerResult.isOk()).toBe(true)

    const getResult = registry.get('pages')
    expect(getResult.isOk()).toBe(true)
    expect(getResult.unwrap().slug).toBe('pages')
  })

  it('returns DUPLICATE_SLUG error when registering the same slug twice', () => {
    const registry = createCollectionRegistry()
    const pages = collection({
      slug: 'pages',
      fields: [field.text({ name: 'title' })]
    })

    registry.register(pages)
    const result = registry.register(pages)

    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.DUPLICATE_SLUG)
  })

  it('registers a collection with all field types', () => {
    const registry = createCollectionRegistry()
    const everything = collection({
      slug: 'everything',
      fields: [
        field.text({ name: 'title' }),
        field.slug({ name: 'slug', unique: true }),
        field.textarea({ name: 'summary' }),
        field.richtext({ name: 'body' }),
        field.boolean({ name: 'published' }),
        field.number({ name: 'viewCount' }),
        field.date({ name: 'publishedAt' }),
        field.select({
          name: 'status',
          options: [
            { label: 'Draft', value: 'draft' },
            { label: 'Published', value: 'published' }
          ]
        }),
        field.email({ name: 'contactEmail' }),
        field.url({ name: 'website' }),
        field.json({ name: 'metadata' }),
        field.color({ name: 'brandColor' }),
        field.password({ name: 'secret' }),
        field.media({ name: 'cover', relationTo: 'media' }),
        field.relation({ name: 'author', relationTo: 'users' })
      ]
    })

    const result = registry.register(everything)
    expect(result.isOk()).toBe(true)
    expect(registry.has('everything')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// generateCreateTableSql
// ---------------------------------------------------------------------------

describe('generateCreateTableSql()', () => {
  it('produces valid SQL with correct column types for basic fields', () => {
    const posts = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true, unique: true }),
        field.boolean({ name: 'published' }),
        field.number({ name: 'viewCount' })
      ]
    })

    const sql = generateCreateTableSql(posts)

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "posts"')
    expect(sql).toContain('"id" UUID PRIMARY KEY DEFAULT gen_random_uuid()')
    expect(sql).toContain('"title" TEXT NOT NULL')
    expect(sql).toContain('"slug" TEXT NOT NULL UNIQUE')
    expect(sql).toContain('"published"')
    expect(sql).toContain('"viewCount"')
  })

  it('includes timestamp columns when timestamps: true', () => {
    const posts = collection({
      slug: 'articles',
      timestamps: true,
      fields: [field.text({ name: 'title' })]
    })

    const sql = generateCreateTableSql(posts)

    expect(sql).toContain('"created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    expect(sql).toContain('"updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
  })

  it('omits timestamp columns when timestamps: false', () => {
    const logs = collection({
      slug: 'logs',
      timestamps: false,
      fields: [field.text({ name: 'msg' })]
    })

    const sql = generateCreateTableSql(logs)

    expect(sql).not.toContain('created_at')
    expect(sql).not.toContain('updated_at')
  })

  it('always includes soft-delete column', () => {
    const withTs = collection({
      slug: 'with_ts',
      timestamps: true,
      fields: [field.text({ name: 'x' })]
    })
    const withoutTs = collection({
      slug: 'without_ts',
      timestamps: false,
      fields: [field.text({ name: 'x' })]
    })

    expect(generateCreateTableSql(withTs)).toContain('"deleted_at" TIMESTAMPTZ')
    expect(generateCreateTableSql(withoutTs)).toContain('"deleted_at" TIMESTAMPTZ')
  })
})

// ---------------------------------------------------------------------------
// generateZodSchema
// ---------------------------------------------------------------------------

describe('generateZodSchema()', () => {
  it('validates a required text field', () => {
    const schema = generateZodSchema([
      field.text({ name: 'title', required: true })
    ])

    expect(schema.safeParse({ title: 'Hello' }).success).toBe(true)
  })

  it('rejects an object missing a required field', () => {
    const schema = generateZodSchema([
      field.text({ name: 'title', required: true })
    ])

    expect(schema.safeParse({}).success).toBe(false)
  })

  it('accepts an object with all optional fields absent', () => {
    const schema = generateZodSchema([
      field.text({ name: 'summary' }),
      field.boolean({ name: 'published' })
    ])

    expect(schema.safeParse({}).success).toBe(true)
  })

  it('validates multiple required fields — rejects when any is missing', () => {
    const schema = generateZodSchema([
      field.text({ name: 'title', required: true }),
      field.text({ name: 'body', required: true })
    ])

    expect(schema.safeParse({ title: 'Hi', body: 'Content' }).success).toBe(true)
    expect(schema.safeParse({ title: 'Hi' }).success).toBe(false)
    expect(schema.safeParse({ body: 'Content' }).success).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Global registry
// ---------------------------------------------------------------------------

describe('GlobalRegistry', () => {
  it('registers a global config and retrieves it by slug', () => {
    const registry = createGlobalRegistry()
    const settings = global({
      slug: 'site-settings',
      fields: [field.text({ name: 'siteName', required: true })]
    })

    const registerResult = registry.register(settings)
    expect(registerResult.isOk()).toBe(true)

    const getResult = registry.get('site-settings')
    expect(getResult.isOk()).toBe(true)
    expect(getResult.unwrap().slug).toBe('site-settings')
  })

  it('returns DUPLICATE_SLUG error for duplicate global slug', () => {
    const registry = createGlobalRegistry()
    const nav = global({ slug: 'nav', fields: [] })

    registry.register(nav)
    const result = registry.register(nav)

    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.DUPLICATE_SLUG)
  })

  it('getAll returns all registered globals', () => {
    const registry = createGlobalRegistry()
    registry.register(global({ slug: 'nav', fields: [] }))
    registry.register(global({ slug: 'footer', fields: [] }))

    expect(registry.getAll()).toHaveLength(2)
  })
})
