import { describe, it, expect } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { SqlValue } from '../db/query-types.js'

interface MockSqlCalls {
  unsafe: { mock: { calls: readonly (readonly [string, readonly SqlValue[]])[] } }
}

function setup (poolReturn: readonly Record<string, string | number | null>[] = [{ id: 'd1', title: 'Updated' }]) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [field.text({ name: 'title', required: true })]
  }))
  const api = createLocalApi(pool, collections, createGlobalRegistry())
  return { pool, api }
}

function executedSql (pool: ReturnType<typeof makeMockPool>): readonly string[] {
  return (pool.sql as MockSqlCalls).unsafe.mock.calls.map(c => c[0])
}

describe('local API — atomic revision write', () => {
  it('update with createRevision issues a document_revisions INSERT (in the write transaction)', async () => {
    const { pool, api } = setup()
    const result = await api.update({ collection: 'posts', id: 'd1', data: { title: 'Updated' }, createRevision: true })

    expect(result.isOk()).toBe(true)
    const sql = executedSql(pool)
    expect(sql.some(s => /insert into\s+"document_revisions"/i.test(s))).toBe(true)
    // The document UPDATE must also have run — both live in one begin() tx.
    expect(sql.some(s => /update\s+"posts"/i.test(s))).toBe(true)
  })

  it('update without createRevision writes no revision (REST/GraphQL path unchanged)', async () => {
    const { pool, api } = setup()
    await api.update({ collection: 'posts', id: 'd1', data: { title: 'Updated' } })

    const sql = executedSql(pool)
    expect(sql.some(s => /document_revisions/i.test(s))).toBe(false)
  })

  it('revision snapshot records the id under the write transaction params', async () => {
    const { pool, api } = setup()
    await api.update({ collection: 'posts', id: 'd1', data: { title: 'Updated' }, createRevision: true })

    const calls = (pool.sql as MockSqlCalls).unsafe.mock.calls
    const revisionInsert = calls.find(c => /insert into\s+"document_revisions"/i.test(c[0]))
    expect(revisionInsert).toBeDefined()
    // params: [collection_slug, document_id, revision_number, data]
    expect(revisionInsert?.[1]).toContain('posts')
    expect(revisionInsert?.[1]).toContain('d1')
  })
})
