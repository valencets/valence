import { describe, it, expect, vi } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { HookFunction } from '../hooks/hook-types.js'

function setupWithHooks (hooks: {
  beforeValidate?: HookFunction[]
  beforeDelete?: HookFunction[]
  afterDelete?: HookFunction[]
  beforeRead?: HookFunction[]
}) {
  const pool = makeMockPool([{ id: '1', title: 'Test', slug: 'test' }])
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
  const api = createLocalApi(pool, collections, globals)
  return { pool, api }
}

describe('beforeValidate hooks', () => {
  it('fires before create', async () => {
    const calls: string[] = []
    const hook = vi.fn((args) => { calls.push('beforeValidate'); return args.data })
    const { api } = setupWithHooks({ beforeValidate: [hook] })
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })
    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'New', slug: 'new' }),
      collection: 'posts'
    }))
  })

  it('fires before update', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupWithHooks({ beforeValidate: [hook] })
    const result = await api.update({ collection: 'posts', id: '1', data: { title: 'Updated' } })
    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'Updated' }),
      id: '1',
      collection: 'posts'
    }))
  })

  it('can transform data before create', async () => {
    const hook = vi.fn((args) => ({ ...args.data, title: 'Transformed' }))
    const { api } = setupWithHooks({ beforeValidate: [hook] })
    const result = await api.create({ collection: 'posts', data: { title: 'Original', slug: 'original' } })
    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    // Hook received original data and returned transformed data
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'Original', slug: 'original' })
    }))
  })

  it('aborts create when hook throws', async () => {
    const hook = vi.fn(() => { throw new Error('validation blocked') })
    const { api } = setupWithHooks({ beforeValidate: [hook] })
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('validation blocked')
  })

  it('aborts update when hook throws', async () => {
    const hook = vi.fn(() => { throw new Error('validation blocked') })
    const { api } = setupWithHooks({ beforeValidate: [hook] })
    const result = await api.update({ collection: 'posts', id: '1', data: { title: 'Updated' } })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('validation blocked')
  })

  it('does not fire when no hooks configured', async () => {
    const { api } = setupWithHooks({})
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })
    expect(result.isOk()).toBe(true)
  })
})

describe('beforeDelete hooks', () => {
  it('fires before delete', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupWithHooks({ beforeDelete: [hook] })
    const result = await api.delete({ collection: 'posts', id: '1' })
    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      collection: 'posts'
    }))
  })

  it('aborts delete when hook throws', async () => {
    const hook = vi.fn(() => { throw new Error('delete blocked') })
    const { api } = setupWithHooks({ beforeDelete: [hook] })
    const result = await api.delete({ collection: 'posts', id: '1' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('delete blocked')
  })

  it('does not fire when no hooks configured', async () => {
    const { api } = setupWithHooks({})
    const result = await api.delete({ collection: 'posts', id: '1' })
    expect(result.isOk()).toBe(true)
  })
})

describe('afterDelete hooks', () => {
  it('fires after successful delete', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupWithHooks({ afterDelete: [hook] })
    const result = await api.delete({ collection: 'posts', id: '1' })
    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      collection: 'posts',
      data: expect.objectContaining({ id: '1', title: 'Test' })
    }))
  })

  it('fires both beforeDelete and afterDelete in order', async () => {
    const calls: string[] = []
    const beforeHook = vi.fn(() => { calls.push('before'); return undefined })
    const afterHook = vi.fn(() => { calls.push('after'); return undefined })
    const { api } = setupWithHooks({ beforeDelete: [beforeHook], afterDelete: [afterHook] })
    const result = await api.delete({ collection: 'posts', id: '1' })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['before', 'after'])
  })

  it('does not fire when no hooks configured', async () => {
    const { api } = setupWithHooks({})
    const result = await api.delete({ collection: 'posts', id: '1' })
    expect(result.isOk()).toBe(true)
  })
})

describe('beforeRead hooks', () => {
  it('fires before find', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupWithHooks({ beforeRead: [hook] })
    const result = await api.find({ collection: 'posts' })
    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      collection: 'posts'
    }))
  })

  it('fires before findByID', async () => {
    const hook = vi.fn((args) => args.data)
    const { api } = setupWithHooks({ beforeRead: [hook] })
    const result = await api.findByID({ collection: 'posts', id: '1' })
    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      collection: 'posts'
    }))
  })

  it('aborts find when hook throws', async () => {
    const hook = vi.fn(() => { throw new Error('read blocked') })
    const { api } = setupWithHooks({ beforeRead: [hook] })
    const result = await api.find({ collection: 'posts' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('read blocked')
  })

  it('aborts findByID when hook throws', async () => {
    const hook = vi.fn(() => { throw new Error('read blocked') })
    const { api } = setupWithHooks({ beforeRead: [hook] })
    const result = await api.findByID({ collection: 'posts', id: '1' })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('read blocked')
  })

  it('does not fire when no hooks configured', async () => {
    const { api } = setupWithHooks({})
    const result = await api.find({ collection: 'posts' })
    expect(result.isOk()).toBe(true)
  })
})
