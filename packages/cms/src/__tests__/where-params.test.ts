import { describe, it, expect, vi } from 'vitest'
import { createQueryBuilder } from '../db/query-builder.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

function setupRegistry () {
  const registry = createCollectionRegistry()
  registry.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.boolean({ name: 'published' })
    ]
  }))
  return registry
}

describe('where clause parameter indexing', () => {
  it('$1 maps to first where value with soft-delete enabled (default)', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts').where('title', 'equals', 'Hello').all()

    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call?.[0] as string
    const params = call?.[1] as string[]

    expect(sql).toContain('"deleted_at" IS NULL')
    expect(sql).toContain('"title" = $1')
    expect(params).toEqual(['Hello'])
  })

  it('$1 and $2 map correctly with two where clauses', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts')
      .where('title', 'equals', 'Hello')
      .where('published', 'equals', true)
      .all()

    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call?.[0] as string
    const params = call?.[1] as unknown[]

    expect(sql).toContain('"title" = $1')
    expect(sql).toContain('"published" = $2')
    expect(params).toEqual(['Hello', true])
  })

  it('exists operator does not consume a parameter slot', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts')
      .where('title', 'exists', true)
      .where('published', 'equals', false)
      .all()

    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call?.[0] as string
    const params = call?.[1] as unknown[]

    expect(sql).toContain('"title" IS NOT NULL')
    expect(sql).toContain('"published" = $1')
    expect(params).toEqual([false])
  })
})
