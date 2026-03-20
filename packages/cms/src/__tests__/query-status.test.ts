import { describe, it, expect } from 'vitest'
import { createQueryBuilder } from '../db/query-builder.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

function setupVersionedQuery () {
  const pool = makeMockPool([{ id: '1', title: 'Test', _status: 'published' }])
  const registry = createCollectionRegistry()
  registry.register(collection({
    slug: 'posts',
    fields: [field.text({ name: 'title', required: true })],
    versions: { drafts: true }
  }))
  const qb = createQueryBuilder(pool, registry)
  return { pool, qb }
}

function setupNonVersionedQuery () {
  const pool = makeMockPool([{ id: '1', title: 'Test' }])
  const registry = createCollectionRegistry()
  registry.register(collection({
    slug: 'pages',
    fields: [field.text({ name: 'title', required: true })]
  }))
  const qb = createQueryBuilder(pool, registry)
  return { pool, qb }
}

function getExecutedSql (pool: ReturnType<typeof makeMockPool>): string {
  return (pool.sql as { unsafe: { mock: { calls: string[][] } } }).unsafe.mock.calls[0]?.[0] ?? ''
}

describe('query builder status filtering', () => {
  it('adds _status = published filter for versioned collections by default', async () => {
    const { pool, qb } = setupVersionedQuery()
    await qb.query('posts').all()
    const sql = getExecutedSql(pool)
    expect(sql).toContain("\"_status\" = 'published'")
  })

  it('does NOT add _status filter for non-versioned collections', async () => {
    const { pool, qb } = setupNonVersionedQuery()
    await qb.query('pages').all()
    const sql = getExecutedSql(pool)
    expect(sql).not.toContain('_status')
  })

  it('.includeDrafts() removes the _status filter', async () => {
    const { pool, qb } = setupVersionedQuery()
    await qb.query('posts').includeDrafts().all()
    const sql = getExecutedSql(pool)
    expect(sql).not.toContain("\"_status\" = 'published'")
  })

  it('status filter works with .first()', async () => {
    const { pool, qb } = setupVersionedQuery()
    await qb.query('posts').first()
    const sql = getExecutedSql(pool)
    expect(sql).toContain("\"_status\" = 'published'")
  })

  it('status filter works with .count()', async () => {
    const { pool, qb } = setupVersionedQuery()
    await qb.query('posts').count()
    const sql = getExecutedSql(pool)
    expect(sql).toContain("\"_status\" = 'published'")
  })

  it('.includeDrafts() is chainable with other methods', async () => {
    const { pool, qb } = setupVersionedQuery()
    await qb.query('posts').includeDrafts().where('title', 'Test').all()
    const sql = getExecutedSql(pool)
    expect(sql).not.toContain("\"_status\" = 'published'")
    expect(sql).toContain('"title"')
  })

  it('status filter combines with soft-delete filter', async () => {
    const { pool, qb } = setupVersionedQuery()
    await qb.query('posts').all()
    const sql = getExecutedSql(pool)
    expect(sql).toContain('"deleted_at" IS NULL')
    expect(sql).toContain("\"_status\" = 'published'")
  })
})
