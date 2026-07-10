import { describe, it, expect, vi } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { HookArgs, HookFunction, CollectionHooks } from '../hooks/hook-types.js'
import type { FieldConfig } from '../schema/field-types.js'

// #335 — every advertised lifecycle hook must actually fire, in a defined
// order. The canonical write order is:
//   beforeValidate(col) → beforeValidate(field) → beforeChange(col) →
//   beforeChange(field) → write → afterChange(field) → afterChange(col)
// publish updates nest the write in beforePublish → write → afterPublish.
// The canonical read order is:
//   beforeRead(col) → query → afterRead(field) → afterRead(col), per row.

type MockCalls = ReadonlyArray<ReadonlyArray<unknown>>

function unsafeCalls (pool: ReturnType<typeof makeMockPool>): MockCalls {
  return (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls
}

function setup (options: {
  rows?: Array<Record<string, string | number | null>>
  hooks?: CollectionHooks
  fields?: FieldConfig[]
  drafts?: boolean
}) {
  const pool = makeMockPool(options.rows ?? [{ id: 'new-1', title: 'Test', slug: 'test' }])
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: options.fields ?? [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true })
    ],
    ...(options.drafts ? { versions: { drafts: true } } : {}),
    ...(options.hooks ? { hooks: options.hooks } : {})
  }))
  const api = createLocalApi(pool, collections, globals)
  return { pool, api }
}

describe('beforeChange (collection)', () => {
  it('fires on create with the incoming data and collection slug', async () => {
    const hook = vi.fn((args: HookArgs) => args.data)
    const { api } = setup({ hooks: { beforeChange: [hook] } })

    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })

    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ title: 'New', slug: 'new' }),
      collection: 'posts'
    }))
  })

  it('transforms data before the INSERT', async () => {
    const hook: HookFunction = ({ data }) => ({ ...data, title: 'From Hook' })
    const { api, pool } = setup({ hooks: { beforeChange: [hook] } })

    const result = await api.create({ collection: 'posts', data: { title: 'Original', slug: 'orig' } })

    expect(result.isOk()).toBe(true)
    const insert = unsafeCalls(pool).find(call => String(call[0]).includes('INSERT INTO'))
    expect(insert).toBeDefined()
    expect(insert![1]).toContain('From Hook')
  })

  it('fires on update with the document id', async () => {
    const hook = vi.fn((args: HookArgs) => args.data)
    const { api } = setup({ hooks: { beforeChange: [hook] } })

    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Updated' } })

    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      id: 'abc',
      collection: 'posts'
    }))
  })

  it('aborts the create when it throws — nothing is inserted', async () => {
    const hook: HookFunction = () => {
      throw new Error('change blocked')
    }
    const { api, pool } = setup({ hooks: { beforeChange: [hook] } })

    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })

    expect(result.isErr()).toBe(true)
    expect(result.isErr() && result.error.message).toContain('change blocked')
    const insert = unsafeCalls(pool).find(call => String(call[0]).includes('INSERT INTO'))
    expect(insert).toBeUndefined()
  })
})

describe('afterChange (collection)', () => {
  it('fires after create with the written row', async () => {
    const hook = vi.fn((args: HookArgs) => args.data)
    const { api } = setup({ hooks: { afterChange: [hook] } })

    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })

    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'new-1' }),
      collection: 'posts'
    }))
  })

  it('fires after update', async () => {
    const hook = vi.fn((args: HookArgs) => args.data)
    const { api } = setup({ hooks: { afterChange: [hook] } })

    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Updated' } })

    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
  })

  it('fires on publish updates, after afterPublish', async () => {
    const calls: string[] = []
    const { api } = setup({
      drafts: true,
      hooks: {
        beforePublish: [(args: HookArgs) => { calls.push('beforePublish'); return args.data }],
        afterPublish: [(args: HookArgs) => { calls.push('afterPublish'); return args.data }],
        afterChange: [(args: HookArgs) => { calls.push('afterChange'); return args.data }]
      }
    })

    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Live' }, publish: true })

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['beforePublish', 'afterPublish', 'afterChange'])
  })
})

describe('afterRead (collection)', () => {
  it('fires on find once per returned document', async () => {
    const hook = vi.fn((args: HookArgs) => args.data)
    const { api } = setup({
      rows: [
        { id: '1', title: 'One', slug: 'one' },
        { id: '2', title: 'Two', slug: 'two' }
      ],
      hooks: { afterRead: [hook] }
    })

    const result = await api.find({ collection: 'posts' })

    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(2)
  })

  it('can transform returned documents', async () => {
    const hook: HookFunction = ({ data }) => ({ ...data, title: 'Decorated' })
    const { api } = setup({ rows: [{ id: '1', title: 'Plain', slug: 'p' }], hooks: { afterRead: [hook] } })

    const result = await api.find({ collection: 'posts' })

    expect(result.isOk()).toBe(true)
    const docs = result.isOk() ? result.value : []
    expect(Array.isArray(docs) && docs[0]?.title).toBe('Decorated')
  })

  it('fires on findByID with the document id', async () => {
    const hook = vi.fn((args: HookArgs) => args.data)
    const { api } = setup({ rows: [{ id: '1', title: 'One', slug: 'one' }], hooks: { afterRead: [hook] } })

    const result = await api.findByID({ collection: 'posts', id: '1' })

    expect(result.isOk()).toBe(true)
    expect(hook).toHaveBeenCalledTimes(1)
    expect(hook).toHaveBeenCalledWith(expect.objectContaining({
      id: '1',
      collection: 'posts'
    }))
  })
})

describe('beforeValidate (field)', () => {
  it('fires on create and can transform the field value', async () => {
    const { api, pool } = setup({
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: { beforeValidate: [({ data }: HookArgs) => ({ ...data, title: 'Normalized' })] }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    })

    const result = await api.create({ collection: 'posts', data: { title: 'raw input', slug: 'raw' } })

    expect(result.isOk()).toBe(true)
    const insert = unsafeCalls(pool).find(call => String(call[0]).includes('INSERT INTO'))
    expect(insert).toBeDefined()
    expect(insert![1]).toContain('Normalized')
  })

  it('fires on update', async () => {
    const calls: string[] = []
    const { api } = setup({
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: { beforeValidate: [({ data }: HookArgs) => { calls.push('field-beforeValidate'); return data }] }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    })

    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Updated' } })

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['field-beforeValidate'])
  })
})

describe('canonical firing order', () => {
  function trackingHooks (calls: string[]): CollectionHooks {
    const track = (name: string): HookFunction => (args) => { calls.push(name); return args.data }
    return {
      beforeValidate: [track('beforeValidate:col')],
      beforeChange: [track('beforeChange:col')],
      afterChange: [track('afterChange:col')]
    }
  }

  function trackingFields (calls: string[]): FieldConfig[] {
    const track = (name: string): HookFunction => (args) => { calls.push(name); return args.data }
    return [
      field.text({
        name: 'title',
        required: true,
        hooks: {
          beforeValidate: [track('beforeValidate:field')],
          beforeChange: [track('beforeChange:field')],
          afterChange: [track('afterChange:field')]
        }
      }),
      field.slug({ name: 'slug', required: true })
    ]
  }

  it('create runs beforeValidate(col→field) → beforeChange(col→field) → afterChange(field→col)', async () => {
    const calls: string[] = []
    const { api } = setup({ hooks: trackingHooks(calls), fields: trackingFields(calls) })

    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([
      'beforeValidate:col',
      'beforeValidate:field',
      'beforeChange:col',
      'beforeChange:field',
      'afterChange:field',
      'afterChange:col'
    ])
  })

  it('update runs the same canonical order', async () => {
    const calls: string[] = []
    const { api } = setup({ hooks: trackingHooks(calls), fields: trackingFields(calls) })

    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Updated' } })

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([
      'beforeValidate:col',
      'beforeValidate:field',
      'beforeChange:col',
      'beforeChange:field',
      'afterChange:field',
      'afterChange:col'
    ])
  })

  it('publish updates nest the publish hooks around the write', async () => {
    const calls: string[] = []
    const track = (name: string): HookFunction => (args) => { calls.push(name); return args.data }
    const { api } = setup({
      drafts: true,
      hooks: {
        beforeChange: [track('beforeChange:col')],
        beforePublish: [track('beforePublish')],
        afterPublish: [track('afterPublish')],
        afterChange: [track('afterChange:col')]
      },
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: {
            beforeChange: [track('beforeChange:field')],
            afterChange: [track('afterChange:field')]
          }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    })

    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Live' }, publish: true })

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([
      'beforeChange:col',
      'beforeChange:field',
      'beforePublish',
      'afterPublish',
      'afterChange:field',
      'afterChange:col'
    ])
  })

  it('find runs beforeRead(col) → afterRead(field) → afterRead(col)', async () => {
    const calls: string[] = []
    const track = (name: string): HookFunction => (args) => { calls.push(name); return args.data }
    const { api } = setup({
      rows: [{ id: '1', title: 'One', slug: 'one' }],
      hooks: {
        beforeRead: [track('beforeRead:col')],
        afterRead: [track('afterRead:col')]
      },
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: { afterRead: [track('afterRead:field')] }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    })

    const result = await api.find({ collection: 'posts' })

    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['beforeRead:col', 'afterRead:field', 'afterRead:col'])
  })
})
