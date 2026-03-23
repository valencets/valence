import { describe, it, expect, vi } from 'vitest'
import { createQueryBuilder } from '../db/query-builder.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool, makeSequentialPool } from './test-helpers.js'
function setupRegistry () {
  const registry = createCollectionRegistry()
  registry.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true }),
      field.richtext({ name: 'body' }),
      field.boolean({ name: 'published' })
    ]
  }))
  return registry
}

describe('.search()', () => {
  it('adds search_vector tsquery to SQL', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').search('hello world').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('search_vector')
    expect(sql).toContain('plainto_tsquery')
  })

  it('adds search_rank to SELECT when searching', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').search('hello').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('ts_rank')
    expect(sql).toContain('search_rank')
  })

  it('defaults to ORDER BY search_rank DESC when no explicit orderBy', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').search('hello').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('ORDER BY search_rank DESC')
  })

  it('uses explicit orderBy over search_rank when both present', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').search('hello').orderBy('title', 'asc').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('ORDER BY "title" ASC')
    expect(sql).not.toContain('ORDER BY search_rank')
  })

  it('defaults to english language', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').search('hello').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain("'english'")
  })

  it('accepts custom language parameter', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').search('bonjour', 'french').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain("'french'")
  })

  it('passes search query as parameterized value', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').search('test query').all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const params = call[1] as string[]
    expect(params).toContain('test query')
  })

  it('combines search with where clauses', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts')
      .where('published', true)
      .search('hello')
      .all()
    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call[0] as string
    expect(sql).toContain('"published"')
    expect(sql).toContain('search_vector')
  })

  it('works with .page() for paginated search', async () => {
    const pool = makeSequentialPool([
      [{ count: '5' }],
      [{ id: '1', title: 'Result', search_rank: 0.5 }]
    ])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').search('hello').page(1, 10)
    expect(result.isOk()).toBe(true)
    const paginated = result.unwrap()
    expect(paginated.totalDocs).toBe(5)
    expect(paginated.page).toBe(1)
  })

  it('returns chainable builder', () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const builder = qb.query('posts').search('hello')
    expect(typeof builder.all).toBe('function')
    expect(typeof builder.first).toBe('function')
    expect(typeof builder.count).toBe('function')
    expect(typeof builder.page).toBe('function')
    expect(typeof builder.where).toBe('function')
    expect(typeof builder.orderBy).toBe('function')
  })
})
