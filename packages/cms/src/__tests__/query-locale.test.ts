import { describe, it, expect, vi } from 'vitest'
import { createQueryBuilder } from '../db/query-builder.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, makeSequentialPool } from './test-helpers.js'

function setupLocalizedQuery () {
  const pool = makeMockPool([{ id: '1', title: 'Hello' }])
  const registry = createCollectionRegistry()
  registry.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true, localized: true }),
      field.text({ name: 'body', localized: true }),
      field.text({ name: 'slug', required: true })
    ]
  }))
  const qb = createQueryBuilder(pool, registry, 'en')
  return { pool, qb }
}

describe('query builder .locale()', () => {
  it('generates COALESCE extraction for localized fields when locale is set', async () => {
    const { pool, qb } = setupLocalizedQuery()
    await qb.query('posts').locale('es').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('COALESCE')
    expect(sql).toContain('"title"')
    expect(sql).toContain("'es'")
    expect(sql).toContain("'en'")
  })

  it('does not use COALESCE when locale is not set', async () => {
    const { pool, qb } = setupLocalizedQuery()
    await qb.query('posts').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).not.toContain('COALESCE')
  })

  it('only applies COALESCE to localized fields, not all fields', async () => {
    const { pool, qb } = setupLocalizedQuery()
    await qb.query('posts').locale('es').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    // 'slug' is NOT localized — should not appear in a COALESCE
    expect(sql).not.toContain('COALESCE("slug"')
    // 'title' and 'body' ARE localized — should be in COALESCE
    expect(sql).toContain('COALESCE("title"')
    expect(sql).toContain('COALESCE("body"')
  })

  it('returns the CollectionQueryBuilder for chaining', () => {
    const { qb } = setupLocalizedQuery()
    const builder = qb.query('posts').locale('es')
    expect(typeof builder.where).toBe('function')
    expect(typeof builder.orderBy).toBe('function')
    expect(typeof builder.all).toBe('function')
    expect(typeof builder.first).toBe('function')
    expect(typeof builder.page).toBe('function')
  })

  it('works with collections that have no localized fields', async () => {
    const pool = makeMockPool([{ id: '1', name: 'test' }])
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'tags',
      fields: [field.text({ name: 'name', required: true })]
    }))
    const qb = createQueryBuilder(pool, registry, 'en')
    await qb.query('tags').locale('es').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).not.toContain('COALESCE')
  })

  it('combines locale with search correctly', async () => {
    const { pool, qb } = setupLocalizedQuery()
    await qb.query('posts').locale('fr').search('bonjour').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('COALESCE')
    expect(sql).toContain('ts_rank')
    expect(sql).toContain('search_vector')
    expect(sql).toContain("'fr'")
    expect(sql).toContain("'en'")
  })

  it('combines locale with where clauses', async () => {
    const { pool, qb } = setupLocalizedQuery()
    await qb.query('posts').locale('de').where('slug', 'hello').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('COALESCE')
    expect(sql).toContain('"slug" =')
    expect(sql).toContain("'de'")
  })

  it('works with .first() query', async () => {
    const { pool, qb } = setupLocalizedQuery()
    await qb.query('posts').locale('ja').first()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('COALESCE')
    expect(sql).toContain("'ja'")
    expect(sql).toContain('LIMIT 1')
  })

  it('works with .page() for paginated locale queries', async () => {
    const pool = makeSequentialPool([
      [{ count: '10' }],
      [{ id: '1', title: 'Hola' }]
    ])
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true, localized: true }),
        field.text({ name: 'slug', required: true })
      ]
    }))
    const qb = createQueryBuilder(pool, registry, 'en')
    const result = await qb.query('posts').locale('es').page(1, 5)
    expect(result.isOk()).toBe(true)
    const paginated = result.unwrap()
    expect(paginated.totalDocs).toBe(10)
    // The second call (data query) should have COALESCE
    const dataCall = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[1]
    const dataSql = dataCall[0] as string
    expect(dataSql).toContain('COALESCE')
    expect(dataSql).toContain("'es'")
  })

  it('uses default locale as fallback when no defaultLocale provided', async () => {
    const pool = makeMockPool([{ id: '1', title: 'Hello' }])
    const registry = createCollectionRegistry()
    registry.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true, localized: true })
      ]
    }))
    // No defaultLocale passed to factory
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').locale('fr').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('COALESCE')
    // When no defaultLocale, falls back to the requested locale itself
    expect(sql).toContain("'fr'")
  })

  it('escapes single quotes in locale codes', async () => {
    const { pool, qb } = setupLocalizedQuery()
    await qb.query('posts').locale("e's").all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    // Should escape the single quote to prevent SQL injection
    expect(sql).toContain("e''s")
    expect(sql).not.toContain("e's")
  })
})
