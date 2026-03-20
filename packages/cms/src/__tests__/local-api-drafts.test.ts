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

function setupDraftApi (poolReturn: readonly Record<string, string | number | null>[] = [{ id: '1', title: 'Test', _status: 'published' }]) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [field.text({ name: 'title', required: true })],
    versions: { drafts: true }
  }))
  collections.register(collection({
    slug: 'pages',
    fields: [field.text({ name: 'title', required: true })]
  }))
  const globals = createGlobalRegistry()
  const api = createLocalApi(pool, collections, globals)
  return { pool, api }
}

function getExecutedSql (pool: ReturnType<typeof makeMockPool>, callIndex = 0): string {
  return (pool.sql as MockSqlCalls).unsafe.mock.calls[callIndex]?.[0] ?? ''
}

function getExecutedParams (pool: ReturnType<typeof makeMockPool>, callIndex = 0): readonly SqlValue[] {
  return (pool.sql as MockSqlCalls).unsafe.mock.calls[callIndex]?.[1] ?? []
}

describe('local API draft/publish — create', () => {
  it('create with draft: true sets _status to draft for versioned collections', async () => {
    const { pool, api } = setupDraftApi()
    await api.create({ collection: 'posts', data: { title: 'Draft post' }, draft: true })
    const sql = getExecutedSql(pool)
    expect(sql).toContain('_status')
    const params = getExecutedParams(pool)
    expect(params).toContain('draft')
  })

  it('create without draft sets _status to published for versioned collections', async () => {
    const { pool, api } = setupDraftApi()
    await api.create({ collection: 'posts', data: { title: 'Published post' } })
    const sql = getExecutedSql(pool)
    expect(sql).toContain('_status')
    const params = getExecutedParams(pool)
    expect(params).toContain('published')
  })

  it('create does not inject _status for non-versioned collections', async () => {
    const { pool, api } = setupDraftApi()
    await api.create({ collection: 'pages', data: { title: 'Plain page' } })
    const sql = getExecutedSql(pool)
    expect(sql).not.toContain('_status')
  })
})

describe('local API draft/publish — update', () => {
  it('update with publish: true sets _status to published', async () => {
    const { pool, api } = setupDraftApi()
    await api.update({ collection: 'posts', id: '1', data: { title: 'Updated' }, publish: true })
    const sql = getExecutedSql(pool)
    expect(sql).toContain('_status')
    const params = getExecutedParams(pool)
    expect(params).toContain('published')
  })

  it('update with draft: true sets _status to draft', async () => {
    const { pool, api } = setupDraftApi()
    await api.update({ collection: 'posts', id: '1', data: { title: 'Save as draft' }, draft: true })
    const sql = getExecutedSql(pool)
    expect(sql).toContain('_status')
    const params = getExecutedParams(pool)
    expect(params).toContain('draft')
  })

  it('update without publish/draft does not inject _status into SET clause', async () => {
    const { pool, api } = setupDraftApi()
    await api.update({ collection: 'posts', id: '1', data: { title: 'Just update' } })
    const sql = getExecutedSql(pool)
    const setClause = sql.split('SET')[1]?.split('WHERE')[0] ?? ''
    expect(setClause).not.toContain('_status')
  })

  it('update does not inject _status for non-versioned collections', async () => {
    const { pool, api } = setupDraftApi()
    await api.update({ collection: 'pages', id: '1', data: { title: 'Page update' }, publish: true })
    const sql = getExecutedSql(pool)
    expect(sql).not.toContain('_status')
  })
})

describe('local API draft/publish — unpublish', () => {
  it('unpublish sets _status to draft', async () => {
    const { pool, api } = setupDraftApi()
    await api.unpublish({ collection: 'posts', id: '1' })
    const sql = getExecutedSql(pool)
    expect(sql).toContain('_status')
    const params = getExecutedParams(pool)
    expect(params).toContain('draft')
  })

  it('unpublish returns Err for unknown collection', async () => {
    const { api } = setupDraftApi()
    const result = await api.unpublish({ collection: 'nonexistent', id: '1' })
    expect(result.isErr()).toBe(true)
  })
})

describe('local API draft/publish — find', () => {
  it('find without includeDrafts filters to published only for versioned collections', async () => {
    const { pool, api } = setupDraftApi()
    await api.find({ collection: 'posts' })
    const sql = getExecutedSql(pool)
    expect(sql).toContain("\"_status\" = 'published'")
  })

  it('find with includeDrafts: true does not filter by status', async () => {
    const { pool, api } = setupDraftApi()
    await api.find({ collection: 'posts', includeDrafts: true })
    const sql = getExecutedSql(pool)
    expect(sql).not.toContain("\"_status\" = 'published'")
  })

  it('find on non-versioned collection does not add status filter', async () => {
    const { pool, api } = setupDraftApi()
    await api.find({ collection: 'pages' })
    const sql = getExecutedSql(pool)
    expect(sql).not.toContain('_status')
  })
})
