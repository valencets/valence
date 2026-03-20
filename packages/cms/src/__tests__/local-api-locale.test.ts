import { describe, it, expect } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

function setupLocalizedApi () {
  const pool = makeMockPool([{ id: '1', title: '{"en":"Hello"}', slug: 'hello' }])
  const collections = createCollectionRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true, localized: true }),
      field.text({ name: 'body', localized: true }),
      field.text({ name: 'slug', required: true })
    ]
  }))
  const globals = createGlobalRegistry()
  const api = createLocalApi(pool, collections, globals, 'en')
  return { pool, api }
}

describe('local API locale support', () => {
  it('find with locale passes locale to query builder', async () => {
    const { pool, api } = setupLocalizedApi()
    await api.find({ collection: 'posts', locale: 'es' })
    const sql = (pool.sql as ReturnType<typeof import('vitest').vi.fn> & { unsafe: ReturnType<typeof import('vitest').vi.fn> }).unsafe.mock.calls[0]?.[0] ?? ''
    expect(sql).toContain('COALESCE')
    expect(sql).toContain("'es'")
  })

  it('find without locale does not use COALESCE', async () => {
    const { pool, api } = setupLocalizedApi()
    await api.find({ collection: 'posts' })
    const sql = (pool.sql as ReturnType<typeof import('vitest').vi.fn> & { unsafe: ReturnType<typeof import('vitest').vi.fn> }).unsafe.mock.calls[0]?.[0] ?? ''
    expect(sql).not.toContain('COALESCE')
  })

  it('create with locale wraps localized fields as JSON', async () => {
    const { pool, api } = setupLocalizedApi()
    await api.create({
      collection: 'posts',
      data: { title: 'Hello', slug: 'hello' },
      locale: 'en'
    })
    const calls = (pool.sql as ReturnType<typeof import('vitest').vi.fn> & { unsafe: ReturnType<typeof import('vitest').vi.fn> }).unsafe.mock.calls
    const params = calls[0]?.[1] ?? []
    const titleParam = params.find((p: string) => typeof p === 'string' && p.includes('"en"'))
    expect(titleParam).toBeDefined()
  })

  it('create with locale does not wrap non-localized fields', async () => {
    const { pool, api } = setupLocalizedApi()
    await api.create({
      collection: 'posts',
      data: { title: 'Hello', slug: 'hello' },
      locale: 'en'
    })
    const calls = (pool.sql as ReturnType<typeof import('vitest').vi.fn> & { unsafe: ReturnType<typeof import('vitest').vi.fn> }).unsafe.mock.calls
    const params = calls[0]?.[1] ?? []
    expect(params).toContain('hello')
  })

  it('create without locale does not wrap any fields', async () => {
    const { pool, api } = setupLocalizedApi()
    await api.create({
      collection: 'posts',
      data: { title: 'Hello', slug: 'hello' }
    })
    const calls = (pool.sql as ReturnType<typeof import('vitest').vi.fn> & { unsafe: ReturnType<typeof import('vitest').vi.fn> }).unsafe.mock.calls
    const params = calls[0]?.[1] ?? []
    expect(params).toContain('Hello')
  })

  it('update with locale wraps localized fields', async () => {
    const { pool, api } = setupLocalizedApi()
    await api.update({
      collection: 'posts',
      id: '1',
      data: { title: 'Updated' },
      locale: 'es'
    })
    const calls = (pool.sql as ReturnType<typeof import('vitest').vi.fn> & { unsafe: ReturnType<typeof import('vitest').vi.fn> }).unsafe.mock.calls
    const lastCall = calls[calls.length - 1]
    const params = lastCall?.[1] ?? []
    const wrappedParam = params.find((p: string) => typeof p === 'string' && p.includes('"es"'))
    expect(wrappedParam).toBeDefined()
  })
})
