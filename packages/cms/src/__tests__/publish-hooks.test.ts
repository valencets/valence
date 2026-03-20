import { describe, it, expect, vi } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { HookFunction } from '../hooks/hook-types.js'

function setupHookApi (hooks: {
  beforePublish?: HookFunction[]
  afterPublish?: HookFunction[]
  beforeUnpublish?: HookFunction[]
  afterUnpublish?: HookFunction[]
}) {
  const pool = makeMockPool([{ id: '1', title: 'Test', _status: 'published' }])
  const collections = createCollectionRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [field.text({ name: 'title', required: true })],
    versions: { drafts: true },
    hooks
  }))
  const globals = createGlobalRegistry()
  const api = createLocalApi(pool, collections, globals)
  return { pool, api }
}

describe('publish/unpublish hooks', () => {
  it('fires beforePublish hook on publish', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupHookApi({ beforePublish: [hook] })
    await api.update({ collection: 'posts', id: '1', data: { title: 'Pub' }, publish: true })
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('fires afterPublish hook on publish', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupHookApi({ afterPublish: [hook] })
    await api.update({ collection: 'posts', id: '1', data: { title: 'Pub' }, publish: true })
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire publish hooks on draft save', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupHookApi({ beforePublish: [hook], afterPublish: [hook] })
    await api.update({ collection: 'posts', id: '1', data: { title: 'Draft' }, draft: true })
    expect(hook).not.toHaveBeenCalled()
  })

  it('fires beforeUnpublish hook on unpublish', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupHookApi({ beforeUnpublish: [hook] })
    await api.unpublish({ collection: 'posts', id: '1' })
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('fires afterUnpublish hook on unpublish', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupHookApi({ afterUnpublish: [hook] })
    await api.unpublish({ collection: 'posts', id: '1' })
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire unpublish hooks on regular update', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupHookApi({ beforeUnpublish: [hook] })
    await api.update({ collection: 'posts', id: '1', data: { title: 'Update' } })
    expect(hook).not.toHaveBeenCalled()
  })

  it('collection config accepts hooks property', () => {
    const col = collection({
      slug: 'posts',
      fields: [field.text({ name: 'title' })],
      versions: { drafts: true },
      hooks: {
        beforePublish: [({ data }) => data],
        afterPublish: [({ data }) => data]
      }
    })
    expect(col.hooks?.beforePublish).toHaveLength(1)
    expect(col.hooks?.afterPublish).toHaveLength(1)
  })

  it('beforePublish hook can transform data before persist', async () => {
    const hook = vi.fn((args) => ({ ...args.data, transformed: true }))
    const { api } = setupHookApi({ beforePublish: [hook] })
    await api.update({ collection: 'posts', id: '1', data: { title: 'Pub' }, publish: true })
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'Pub', _status: 'published' }),
      id: '1',
      collection: 'posts'
    }))
  })

  it('does NOT fire publish hooks on non-versioned collection update', async () => {
    const hook = vi.fn((args) => args.data)
    const pool = makeMockPool([{ id: '1', title: 'Test' }])
    const collections = createCollectionRegistry()
    collections.register(collection({
      slug: 'pages',
      fields: [field.text({ name: 'title', required: true })],
      hooks: {
        beforePublish: [hook],
        afterPublish: [hook]
      }
    }))
    const globals = createGlobalRegistry()
    const api = createLocalApi(pool, collections, globals)
    await api.update({ collection: 'pages', id: '1', data: { title: 'Update' }, publish: true })
    expect(hook).not.toHaveBeenCalled()
  })
})
