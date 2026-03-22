import { describe, it, expect, vi } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { CmsErrorCode } from '../schema/types.js'
import type { DbPool } from '@valencets/db'
import type { HookFunction } from '../hooks/hook-types.js'
import type { MockSql } from './test-helpers.js'
import { asSql } from './test-helpers.js'

/**
 * Creates a mock pool that tracks transaction begin/commit/rollback behavior.
 * When begin(fn) is called, it creates a tx mock and calls fn(tx).
 * If fn throws, begin rejects (simulating rollback).
 * If fn resolves, begin resolves (simulating commit).
 */
function makeTransactionPool (returnValue: readonly Record<string, string | number | null>[] = []) {
  const calls: string[] = []

  const begin = vi.fn(async (fn: (tx: MockSql) => Promise<unknown>) => {
    calls.push('begin')
    const txUnsafe = vi.fn(() => Promise.resolve(returnValue))
    const txSql = Object.assign(
      vi.fn(() => Promise.resolve(returnValue)),
      { unsafe: txUnsafe, begin: vi.fn() }
    ) as MockSql
    const result = await fn(txSql)
    calls.push('commit')
    return result
  })

  const unsafe = vi.fn(() => Promise.resolve(returnValue))
  const sql = Object.assign(
    vi.fn(() => Promise.resolve(returnValue)),
    { unsafe, begin }
  ) as MockSql

  const pool: DbPool = { sql: asSql(sql) }
  return { pool, calls, begin }
}

function setupRegistry (hooks?: {
  beforeValidate?: HookFunction[]
  afterChange?: HookFunction[]
  beforeDelete?: HookFunction[]
  afterDelete?: HookFunction[]
}) {
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ],
    hooks
  }))
  return { collections, globals }
}

describe('create transaction', () => {
  it('wraps insert in a transaction', async () => {
    const { pool, calls } = makeTransactionPool([{ id: '1', title: 'New', slug: 'new' }])
    const { collections, globals } = setupRegistry()
    const api = createLocalApi(pool, collections, globals)

    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ id: '1', title: 'New', slug: 'new' })
    expect(calls).toEqual(['begin', 'commit'])
  })

  it('rolls back when afterChange hook throws', async () => {
    const { pool, calls } = makeTransactionPool([{ id: '1', title: 'New', slug: 'new' }])
    const failingHook: HookFunction = () => { throw new Error('afterChange hook failed') }
    const { globals } = setupRegistry()

    // Register collection with field-level afterChange hook
    // Use a collection-level hook that throws after the insert
    const collectionsWithHook = createCollectionRegistry()
    collectionsWithHook.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: { afterChange: [failingHook] }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    }))

    const api = createLocalApi(pool, collectionsWithHook, globals)
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('afterChange hook failed')
    // Transaction started but never committed (rollback on throw)
    expect(calls).toEqual(['begin'])
  })

  it('rolls back when beforeChange hook throws', async () => {
    const { pool, calls } = makeTransactionPool([{ id: '1', title: 'New', slug: 'new' }])
    const failingHook: HookFunction = () => { throw new Error('beforeChange hook failed') }
    const collectionsWithHook = createCollectionRegistry()
    const { globals } = setupRegistry()

    collectionsWithHook.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: { beforeChange: [failingHook] }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    }))

    const api = createLocalApi(pool, collectionsWithHook, globals)
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('beforeChange hook failed')
    expect(calls).toEqual(['begin'])
  })
})

describe('update transaction', () => {
  it('wraps update in a transaction', async () => {
    const { pool, calls } = makeTransactionPool([{ id: '1', title: 'Updated', slug: 'updated' }])
    const { collections, globals } = setupRegistry()
    const api = createLocalApi(pool, collections, globals)

    const result = await api.update({ collection: 'posts', id: '1', data: { title: 'Updated' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ id: '1', title: 'Updated', slug: 'updated' })
    expect(calls).toEqual(['begin', 'commit'])
  })

  it('rolls back when afterChange hook throws during update', async () => {
    const { pool, calls } = makeTransactionPool([{ id: '1', title: 'Updated', slug: 'updated' }])
    const failingHook: HookFunction = () => { throw new Error('update afterChange failed') }
    const { globals } = setupRegistry()

    const collectionsWithHook = createCollectionRegistry()
    collectionsWithHook.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: { afterChange: [failingHook] }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    }))

    const api = createLocalApi(pool, collectionsWithHook, globals)
    const result = await api.update({ collection: 'posts', id: '1', data: { title: 'Updated' } })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('update afterChange failed')
    expect(calls).toEqual(['begin'])
  })
})

describe('delete transaction', () => {
  it('wraps delete in a transaction', async () => {
    const deleted = { id: '1', title: 'Gone', slug: 'gone', deleted_at: '2026-03-21T00:00:00Z' }
    const { pool, calls } = makeTransactionPool([deleted])
    const { collections, globals } = setupRegistry()
    const api = createLocalApi(pool, collections, globals)

    const result = await api.delete({ collection: 'posts', id: '1' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(deleted)
    expect(calls).toEqual(['begin', 'commit'])
  })

  it('rolls back when afterDelete hook throws', async () => {
    const failingHook: HookFunction = () => { throw new Error('afterDelete hook failed') }
    const deleted = { id: '1', title: 'Gone', slug: 'gone', deleted_at: '2026-03-21T00:00:00Z' }
    const { pool, calls } = makeTransactionPool([deleted])
    const { globals } = setupRegistry()

    const collectionsWithHook = createCollectionRegistry()
    collectionsWithHook.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true })
      ],
      hooks: { afterDelete: [failingHook] }
    }))

    const api = createLocalApi(pool, collectionsWithHook, globals)
    const result = await api.delete({ collection: 'posts', id: '1' })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('afterDelete hook failed')
    expect(calls).toEqual(['begin'])
  })

  it('rolls back when beforeDelete hook throws (no insert reaches DB)', async () => {
    const failingHook: HookFunction = () => { throw new Error('beforeDelete blocked') }
    const { pool, begin } = makeTransactionPool([])
    const { globals } = setupRegistry()

    const collectionsWithHook = createCollectionRegistry()
    collectionsWithHook.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true })
      ],
      hooks: { beforeDelete: [failingHook] }
    }))

    const api = createLocalApi(pool, collectionsWithHook, globals)
    const result = await api.delete({ collection: 'posts', id: '1' })

    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('beforeDelete blocked')
    // beforeDelete runs before the transaction, so begin should not be called
    expect(begin).not.toHaveBeenCalled()
  })
})

describe('transaction error mapping', () => {
  it('maps CmsError through transaction boundary', async () => {
    const { pool } = makeTransactionPool([{ id: '1', title: 'Test', slug: 'test' }])
    const { globals } = setupRegistry()
    const api = createLocalApi(pool, createCollectionRegistry(), globals)

    // Unknown collection triggers NOT_FOUND before transaction
    const result = await api.create({ collection: 'unknown', data: { title: 'x' } })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(CmsErrorCode.NOT_FOUND)
  })
})
