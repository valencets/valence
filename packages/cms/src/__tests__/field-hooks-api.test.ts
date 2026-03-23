import { describe, it, expect } from 'vitest'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { HookArgs } from '../hooks/hook-types.js'

describe('Local API field hooks integration', () => {
  it('create runs field beforeChange hooks', async () => {
    const calls: string[] = []
    const inserted = { id: 'new-1', title: 'New', slug: 'new' }
    const pool = makeMockPool([inserted])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: {
            beforeChange: [({ data }: HookArgs) => { calls.push('title-beforeChange'); return data }]
          }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    }))
    const api = createLocalApi(pool, collections, globals)
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['title-beforeChange'])
  })

  it('update runs field beforeChange hooks', async () => {
    const calls: string[] = []
    const updated = { id: 'abc', title: 'Updated', slug: 'updated' }
    const pool = makeMockPool([updated])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: {
            beforeChange: [({ data }: HookArgs) => { calls.push('title-beforeChange'); return data }]
          }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    }))
    const api = createLocalApi(pool, collections, globals)
    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Updated' } })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['title-beforeChange'])
  })

  it('find runs field afterRead hooks on results', async () => {
    const rows = [{ id: '1', title: 'Hello', slug: 'hello' }]
    const pool = makeMockPool(rows)
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: {
            afterRead: [({ data }: HookArgs) => ({ ...data, title: (data.title as string).toUpperCase() })]
          }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    }))
    const api = createLocalApi(pool, collections, globals)
    const result = await api.find({ collection: 'posts' })
    expect(result.isOk()).toBe(true)
    const docs = result.unwrap()
    expect(Array.isArray(docs)).toBe(true)
    if (Array.isArray(docs)) {
      expect(docs[0]?.title).toBe('HELLO')
    }
  })

  it('findByID runs field afterRead hooks on result', async () => {
    const row = { id: 'abc', title: 'Found', slug: 'found' }
    const pool = makeMockPool([row])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: {
            afterRead: [({ data }: HookArgs) => ({ ...data, title: (data.title as string).toUpperCase() })]
          }
        }),
        field.slug({ name: 'slug', required: true })
      ]
    }))
    const api = createLocalApi(pool, collections, globals)
    const result = await api.findByID({ collection: 'posts', id: 'abc' })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()?.title).toBe('FOUND')
  })

  it('field hooks do not fire for fields without hooks', async () => {
    const calls: string[] = []
    const inserted = { id: 'new-1', title: 'New', slug: 'new' }
    const pool = makeMockPool([inserted])
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
    const result = await api.create({ collection: 'posts', data: { title: 'New', slug: 'new' } })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([])
  })

  it('field hooks coexist with collection publish hooks on update', async () => {
    const calls: string[] = []
    const updated = { id: 'abc', title: 'Published', slug: 'published', _status: 'published' }
    const pool = makeMockPool([updated])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({
          name: 'title',
          required: true,
          hooks: {
            beforeChange: [({ data }: HookArgs) => { calls.push('field-beforeChange'); return data }]
          }
        }),
        field.slug({ name: 'slug', required: true })
      ],
      versions: { drafts: true },
      hooks: {
        beforePublish: [({ data }: HookArgs) => { calls.push('collection-beforePublish'); return data }],
        afterPublish: [({ data }: HookArgs) => { calls.push('collection-afterPublish'); return data }]
      }
    }))
    const api = createLocalApi(pool, collections, globals)
    const result = await api.update({ collection: 'posts', id: 'abc', data: { title: 'Published' }, publish: true })
    expect(result.isOk()).toBe(true)
    expect(calls).toContain('field-beforeChange')
    expect(calls).toContain('collection-beforePublish')
  })
})
