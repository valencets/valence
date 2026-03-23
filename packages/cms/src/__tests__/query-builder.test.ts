import { describe, it, expect, vi } from 'vitest'
import { createQueryBuilder } from '../db/query-builder.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { CmsErrorCode } from '../schema/types.js'
import { makeMockPool, makeErrorPool, asSql } from './test-helpers.js'
import type { MockSql } from './test-helpers.js'
import type { DbPool } from '@valencets/db'

function setupRegistry () {
  const registry = createCollectionRegistry()
  registry.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true }),
      field.boolean({ name: 'published' }),
      field.number({ name: 'order' })
    ]
  }))
  registry.register(collection({
    slug: 'users',
    auth: true,
    fields: [
      field.text({ name: 'name', required: true }),
      field.text({ name: 'email', required: true, unique: true })
    ]
  }))
  return registry
}

describe('createQueryBuilder()', () => {
  it('returns a builder with query() method', () => {
    const pool = makeMockPool()
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    expect(typeof qb.query).toBe('function')
  })
})

describe('query(slug)', () => {
  it('returns a chainable builder', () => {
    const pool = makeMockPool()
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const builder = qb.query('posts')
    expect(typeof builder.where).toBe('function')
    expect(typeof builder.orderBy).toBe('function')
    expect(typeof builder.limit).toBe('function')
    expect(typeof builder.offset).toBe('function')
    expect(typeof builder.first).toBe('function')
    expect(typeof builder.all).toBe('function')
    expect(typeof builder.count).toBe('function')
    expect(typeof builder.insert).toBe('function')
    expect(typeof builder.update).toBe('function')
    expect(typeof builder.delete).toBe('function')
    expect(typeof builder.withDeleted).toBe('function')
  })

  it('chaining returns the same builder type', () => {
    const pool = makeMockPool()
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const builder = qb.query('posts')
      .where('status', 'equals', 'published')
      .orderBy('created_at', 'desc')
      .limit(10)
      .offset(0)
    expect(typeof builder.all).toBe('function')
  })
})

describe('.all()', () => {
  it('returns Ok with rows from pool', async () => {
    const rows = [{ id: '1', title: 'Hello' }, { id: '2', title: 'World' }]
    const pool = makeMockPool(rows)
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').all()
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual(rows)
  })

  it('returns Err on db failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').all()
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.INTERNAL)
  })
})

describe('.first()', () => {
  it('returns Ok with first row', async () => {
    const rows = [{ id: '1', title: 'Hello' }]
    const pool = makeMockPool(rows)
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').first()
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual({ id: '1', title: 'Hello' })
  })

  it('returns Ok(null) when no rows', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').first()
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBeNull()
  })
})

describe('.count()', () => {
  it('returns Ok with count number', async () => {
    const pool = makeMockPool([{ count: '42' }])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').count()
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(42)
  })
})

describe('.insert()', () => {
  it('returns Ok with inserted row', async () => {
    const inserted = { id: 'abc-123', title: 'New Post', slug: 'new-post' }
    const pool = makeMockPool([inserted])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').insert({ title: 'New Post', slug: 'new-post' })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual(inserted)
  })

  it('returns Err on db failure', async () => {
    const pool = makeErrorPool(new Error('unique constraint'))
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').insert({ title: 'Dup' })
    expect(result.isErr()).toBe(true)
  })
})

describe('.update()', () => {
  it('returns Ok with updated row', async () => {
    const updated = { id: 'abc-123', title: 'Updated' }
    const pool = makeMockPool([updated])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts')
      .where('id', 'equals', 'abc-123')
      .update({ title: 'Updated' })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual(updated)
  })
})

describe('.delete()', () => {
  it('returns Ok with deleted row', async () => {
    const deleted = { id: 'abc-123', title: 'Gone' }
    const pool = makeMockPool([deleted])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts')
      .where('id', 'equals', 'abc-123')
      .delete()
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual(deleted)
  })
})

describe('.where()', () => {
  it('calls sql with where condition', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts')
      .where('published', 'equals', true)
      .all()
    expect(pool.sql.unsafe).toHaveBeenCalled()
  })

  it('supports shorthand where(field, value) defaulting to equals', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const builder = qb.query('posts').where('published', true)
    expect(typeof builder.all).toBe('function')
    await builder.all()
    expect(pool.sql.unsafe).toHaveBeenCalled()
  })

  it('supports WhereClause or conditions', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    await qb.query('posts')
      .whereClause({
        or: [
          { field: 'title', operator: 'equals', value: 'Hello' },
          { field: 'slug', operator: 'equals', value: 'hello' }
        ]
      })
      .all()

    const call = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls[0]
    const sql = call?.[0] as string
    const params = call?.[1] as unknown[]

    expect(sql).toContain('(("title" = $1) OR ("slug" = $2))')
    expect(params).toEqual(['Hello', 'hello'])
  })
})

describe('.withDeleted()', () => {
  it('returns a chainable builder', async () => {
    const pool = makeMockPool([])
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const builder = qb.query('posts').withDeleted()
    expect(typeof builder.all).toBe('function')
    await builder.all()
    expect(pool.sql.unsafe).toHaveBeenCalled()
  })
})

describe('.page()', () => {
  it('returns paginated result', async () => {
    const rows = [{ id: '1', title: 'A' }]
    const countResult = [{ count: '25' }]
    let callIdx = 0
    const unsafe = vi.fn(() => {
      callIdx++
      return Promise.resolve(callIdx === 1 ? countResult : rows)
    })
    const sql = Object.assign(
      vi.fn(() => Promise.resolve([])),
      { unsafe }
    ) as MockSql
    const pool: DbPool = { sql: asSql(sql) }
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('posts').page(1, 10)
    expect(result.isOk()).toBe(true)
    const paginated = result.unwrap()
    expect(paginated.page).toBe(1)
    expect(paginated.limit).toBe(10)
    expect(paginated.totalDocs).toBe(25)
    expect(paginated.totalPages).toBe(3)
    expect(paginated.hasNextPage).toBe(true)
    expect(paginated.hasPrevPage).toBe(false)
  })
})

describe('unknown collection', () => {
  it('all() returns NOT_FOUND error for unregistered slug', async () => {
    const pool = makeMockPool()
    const registry = setupRegistry()
    const qb = createQueryBuilder(pool, registry)
    const result = await qb.query('nonexistent').all()
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(CmsErrorCode.NOT_FOUND)
  })
})
