import { describe, it, expect } from 'vitest'
import { makeMockPool } from '@valencets/db/test'
import {
  collection,
  field,
  createCollectionRegistry,
  generateCreateTableSql,
  generateZodSchema,
  createQueryBuilder,
  buildCms,
  hashPassword,
  verifyPassword
} from '@valencets/cms'

// ── 1. db exports ─────────────────────────────────────────────────────────────

describe('db package exports', () => {
  it('makeMockPool returns a DbPool with a sql property', () => {
    const pool = makeMockPool()
    expect(pool).toBeDefined()
    expect(typeof pool.sql).toBe('function')
  })
})

// ── 2. cms ↔ db boundary ──────────────────────────────────────────────────────

describe('cms ↔ db boundary', () => {
  it('createQueryBuilder accepts a DbPool and returns a factory with .query()', () => {
    const pool = makeMockPool()
    const registry = createCollectionRegistry()
    const qb = createQueryBuilder(pool, registry)

    expect(qb).toBeDefined()
    expect(typeof qb.query).toBe('function')
  })
})

// ── 3. cms schema exports ──────────────────────────────────────────────────────

describe('cms schema exports', () => {
  it('collection() returns a CollectionConfig with required shape', () => {
    const col = collection({
      slug: 'articles',
      fields: [field.text({ name: 'title', required: true })]
    })

    expect(col.slug).toBe('articles')
    expect(Array.isArray(col.fields)).toBe(true)
    expect(typeof col.timestamps).toBe('boolean')
  })

  it('field.text() returns a FieldConfig with type "text"', () => {
    const f = field.text({ name: 'title', required: true })
    expect(f.type).toBe('text')
    expect(f.name).toBe('title')
  })

  it('field.number() returns a FieldConfig with type "number"', () => {
    const f = field.number({ name: 'price' })
    expect(f.type).toBe('number')
  })

  it('field.boolean() returns a FieldConfig with type "boolean"', () => {
    const f = field.boolean({ name: 'published' })
    expect(f.type).toBe('boolean')
  })

  it('field.select() returns a FieldConfig with type "select"', () => {
    const f = field.select({
      name: 'status',
      options: [{ label: 'Draft', value: 'draft' }]
    })
    expect(f.type).toBe('select')
  })
})

// ── 4. buildCms returns Result<CmsInstance> ───────────────────────────────────

describe('buildCms contract', () => {
  it('returns Ok with a CmsInstance containing api, collections, restRoutes, adminRoutes', () => {
    const pool = makeMockPool()
    const result = buildCms({
      db: pool,
      secret: 'test-secret',
      collections: [
        collection({
          slug: 'posts',
          fields: [field.text({ name: 'title', required: true })]
        })
      ]
    })

    expect(result.isOk()).toBe(true)
    const cms = result.unwrap()
    expect(cms.api).toBeDefined()
    expect(cms.collections).toBeDefined()
    expect(cms.restRoutes instanceof Map).toBe(true)
    expect(cms.adminRoutes instanceof Map).toBe(true)
  })

  it('returns Err for duplicate collection slugs', () => {
    const pool = makeMockPool()
    const col = collection({ slug: 'dupe', fields: [] })
    const result = buildCms({
      db: pool,
      secret: 'test-secret',
      collections: [col, col]
    })
    expect(result.isErr()).toBe(true)
  })
})

// ── 5. Schema stability snapshot ──────────────────────────────────────────────

describe('generateCreateTableSql stability', () => {
  it('produces deterministic SQL matching snapshot', () => {
    const col = collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.boolean({ name: 'published' })
      ]
    })

    expect(generateCreateTableSql(col)).toMatchSnapshot()
  })

  it('produces deterministic SQL for timestamps: false', () => {
    const col = collection({
      slug: 'logs',
      timestamps: false,
      fields: [field.text({ name: 'message' })]
    })

    expect(generateCreateTableSql(col)).toMatchSnapshot()
  })
})

// ── 6. Zod schema stability ────────────────────────────────────────────────────

describe('generateZodSchema stability', () => {
  it('validates a valid document against the generated schema', () => {
    const schema = generateZodSchema([
      field.text({ name: 'title', required: true }),
      field.number({ name: 'count' }),
      field.boolean({ name: 'active' })
    ])
    const result = schema.safeParse({ title: 'Hello', count: 5, active: true })
    expect(result.success).toBe(true)
  })

  it('rejects a document missing a required field', () => {
    const schema = generateZodSchema([
      field.text({ name: 'title', required: true })
    ])
    expect(schema.safeParse({}).success).toBe(false)
  })

  it('schema shape matches snapshot', () => {
    const schema = generateZodSchema([
      field.text({ name: 'title', required: true }),
      field.number({ name: 'count' }),
      field.boolean({ name: 'active' })
    ])
    // Snapshot the list of keys present in the schema
    expect(Object.keys(schema.shape)).toMatchSnapshot()
  })
})

// ── 7. Auth contract ───────────────────────────────────────────────────────────

describe('auth contract', () => {
  it('hashPassword returns ResultAsync resolving to Ok<string>', async () => {
    const result = await hashPassword('secret123')
    expect(result.isOk()).toBe(true)
    expect(typeof result.unwrap()).toBe('string')
    expect(result.unwrap().length).toBeGreaterThan(0)
  })

  it('verifyPassword returns Ok<true> for correct password', async () => {
    const hashResult = await hashPassword('secret123')
    const hash = hashResult.unwrap()
    const result = await verifyPassword('secret123', hash)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(true)
  })

  it('verifyPassword returns Ok<false> for wrong password', async () => {
    const hashResult = await hashPassword('secret123')
    const hash = hashResult.unwrap()
    const result = await verifyPassword('wrong', hash)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(false)
  })
})

// ── 8. Registry contract ───────────────────────────────────────────────────────

describe('createCollectionRegistry contract', () => {
  it('register() returns Ok<CollectionConfig>', () => {
    const registry = createCollectionRegistry()
    const col = collection({ slug: 'items', fields: [field.text({ name: 'name' })] })
    const result = registry.register(col)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().slug).toBe('items')
  })

  it('register() returns Err on duplicate slug', () => {
    const registry = createCollectionRegistry()
    const col = collection({ slug: 'items', fields: [] })
    registry.register(col)
    expect(registry.register(col).isErr()).toBe(true)
  })

  it('get() returns Ok<CollectionConfig> for a registered slug', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({ slug: 'items', fields: [] }))
    const result = registry.get('items')
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().slug).toBe('items')
  })

  it('get() returns Err for an unknown slug', () => {
    const registry = createCollectionRegistry()
    expect(registry.get('does-not-exist').isErr()).toBe(true)
  })

  it('getAll() returns an array of all registered collections', () => {
    const registry = createCollectionRegistry()
    registry.register(collection({ slug: 'a', fields: [] }))
    registry.register(collection({ slug: 'b', fields: [] }))
    const all = registry.getAll()
    expect(Array.isArray(all)).toBe(true)
    expect(all.length).toBe(2)
    expect(all.map(c => c.slug)).toEqual(expect.arrayContaining(['a', 'b']))
  })
})
