import { describe, it, expect } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { global } from '../schema/global.js'
import { field } from '../schema/fields.js'
import { CmsErrorCode } from '../schema/types.js'
import { makeMockPool, makeSequentialPool } from './test-helpers.js'

function setup (poolReturn: readonly Record<string, string | number | null>[] = []) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ]
  }))
  globals.register(global({
    slug: 'site-settings',
    fields: [field.text({ name: 'siteName' })]
  }))
  const api = createLocalApi(pool, collections, globals)
  return { api, pool }
}

describe('api.find()', () => {
  it('returns Ok with rows', async () => {
    const rows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const { api } = setup(rows)
    const result = await api.find({ collection: 'posts' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
  })

  it('returns Err NOT_FOUND for unknown collection', async () => {
    const { api } = setup()
    const result = await api.find({ collection: 'nope' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(CmsErrorCode.NOT_FOUND)
  })

  it('returns Ok with rows when orderBy is provided', async () => {
    const rows = [{ id: '2', title: 'B' }, { id: '1', title: 'A' }]
    const { api } = setup(rows)
    const result = await api.find({ collection: 'posts', orderBy: { field: 'title', direction: 'asc' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
  })

  it('returns PaginatedResult when page and perPage are provided', async () => {
    const countRows = [{ count: '10' }]
    const docs = [{ id: '1', title: 'A' }, { id: '2', title: 'B' }]
    const pool = makeSequentialPool([countRows, docs])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true })
      ]
    }))
    const api = createLocalApi(pool, collections, globals)
    const result = await api.find({ collection: 'posts', page: 1, perPage: 2 })
    expect(result.isOk()).toBe(true)
    const paginated = result._unsafeUnwrap()
    expect('docs' in paginated).toBe(true)
    if ('docs' in paginated) {
      expect(paginated.docs).toEqual(docs)
      expect(paginated.totalDocs).toBe(10)
      expect(paginated.page).toBe(1)
      expect(paginated.totalPages).toBe(5)
      expect(paginated.hasNextPage).toBe(true)
      expect(paginated.hasPrevPage).toBe(false)
    }
  })

  it('returns Ok with search results when search is provided', async () => {
    const rows = [{ id: '1', title: 'Hello World', search_rank: '0.5' }]
    const { api } = setup(rows)
    const result = await api.find({ collection: 'posts', search: 'hello' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
  })

  it('combines search + where + pagination', async () => {
    const countRows = [{ count: '3' }]
    const docs = [{ id: '1', title: 'Hello' }]
    const pool = makeSequentialPool([countRows, docs])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', required: true })
      ]
    }))
    const api = createLocalApi(pool, collections, globals)
    const result = await api.find({
      collection: 'posts',
      search: 'hello',
      where: { slug: 'hello' },
      page: 1,
      perPage: 1
    })
    expect(result.isOk()).toBe(true)
    const paginated = result._unsafeUnwrap()
    expect('docs' in paginated).toBe(true)
    if ('docs' in paginated) {
      expect(paginated.docs).toEqual(docs)
      expect(paginated.totalDocs).toBe(3)
    }
  })

  it('backwards compatible: limit still works without page/perPage', async () => {
    const rows = [{ id: '1', title: 'Hello' }]
    const { api } = setup(rows)
    const result = await api.find({ collection: 'posts', limit: 5 })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(rows)
  })
})

describe('api.findByID()', () => {
  it('returns Ok with single row', async () => {
    const row = { id: 'abc', title: 'Found' }
    const { api } = setup([row])
    const result = await api.findByID({ collection: 'posts', id: 'abc' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(row)
  })

  it('returns Ok(null) when not found', async () => {
    const { api } = setup([])
    const result = await api.findByID({ collection: 'posts', id: 'missing' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })
})

describe('api.create()', () => {
  it('returns Ok with inserted row', async () => {
    const inserted = { id: 'new-1', title: 'New', slug: 'new' }
    const { api } = setup([inserted])
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(inserted)
  })
})

describe('api.update()', () => {
  it('returns Ok with updated row', async () => {
    const updated = { id: 'abc', title: 'Updated', slug: 'updated' }
    const { api } = setup([updated])
    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Updated' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(updated)
  })
})

describe('api.delete()', () => {
  it('returns Ok with soft-deleted row', async () => {
    const deleted = { id: 'abc', title: 'Gone', deleted_at: '2026-03-18T00:00:00Z' }
    const { api } = setup([deleted])
    const result = await api.delete({ collection: 'posts', id: 'abc' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(deleted)
  })
})

describe('api.count()', () => {
  it('returns Ok with count', async () => {
    const { api } = setup([{ count: '42' }])
    const result = await api.count({ collection: 'posts' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(42)
  })
})

describe('api.findGlobal()', () => {
  it('returns Ok with global row', async () => {
    const row = { id: '1', siteName: 'My Site' }
    const { api } = setup([row])
    const result = await api.findGlobal({ slug: 'site-settings' })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(row)
  })

  it('returns Err NOT_FOUND for unknown global', async () => {
    const { api } = setup()
    const result = await api.findGlobal({ slug: 'nope' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe(CmsErrorCode.NOT_FOUND)
  })
})

describe('api.updateGlobal()', () => {
  it('returns Ok with updated global', async () => {
    const updated = { id: '1', siteName: 'Updated Site' }
    const { api } = setup([updated])
    const result = await api.updateGlobal({ slug: 'site-settings', data: { siteName: 'Updated Site' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual(updated)
  })
})
