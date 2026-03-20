import { describe, it, expect, vi } from 'vitest'
import type { FieldConfig, TextFieldConfig } from '../schema/field-types.js'
import type { FieldAccess } from '../access/access-types.js'
import { createLocalApi } from '../api/local-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

describe('FieldBaseConfig access property', () => {
  it('accepts access with read, create, update functions', () => {
    const access: FieldAccess = {
      read: () => true,
      create: () => false,
      update: () => true
    }
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'secret',
      access
    }
    expect(fieldConfig.access).toBeDefined()
    expect(fieldConfig.access?.read).toBeTypeOf('function')
    expect(fieldConfig.access?.create).toBeTypeOf('function')
    expect(fieldConfig.access?.update).toBeTypeOf('function')
  })

  it('works without access (backward compat)', () => {
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'title'
    }
    expect(fieldConfig.access).toBeUndefined()
  })

  it('accepts partial access (only read)', () => {
    const fieldConfig: FieldConfig = {
      type: 'text',
      name: 'internal',
      access: {
        read: () => false
      }
    }
    expect(fieldConfig.access?.read).toBeTypeOf('function')
    expect(fieldConfig.access?.create).toBeUndefined()
    expect(fieldConfig.access?.update).toBeUndefined()
  })
})

function setupWithAccess (poolReturn: readonly Record<string, string | number | null>[] = []) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'articles',
    fields: [
      field.text({ name: 'title', required: true }),
      field.text({ name: 'secret', access: { read: () => false } }),
      field.text({ name: 'visible', access: { read: () => true } }),
      field.text({ name: 'noAccess' })
    ]
  }))
  const api = createLocalApi(pool, collections, globals)
  return { api, pool }
}

describe('field-level read filtering', () => {
  it('strips fields where access.read returns false from find response', async () => {
    const rows = [{ id: '1', title: 'Hello', secret: 'hidden', visible: 'shown', noAccess: 'open' }]
    const { api } = setupWithAccess(rows)
    const result = await api.find({ collection: 'articles' })
    expect(result.isOk()).toBe(true)
    const docs = result._unsafeUnwrap() as Record<string, string | number | null>[]
    expect(docs[0]).not.toHaveProperty('secret')
    expect(docs[0]).toHaveProperty('visible', 'shown')
    expect(docs[0]).toHaveProperty('noAccess', 'open')
    expect(docs[0]).toHaveProperty('title', 'Hello')
  })

  it('strips fields where access.read returns false from findByID response', async () => {
    const row = { id: '1', title: 'Hello', secret: 'hidden', visible: 'shown' }
    const { api } = setupWithAccess([row])
    const result = await api.findByID({ collection: 'articles', id: '1' })
    expect(result.isOk()).toBe(true)
    const doc = result._unsafeUnwrap() as Record<string, string | number | null>
    expect(doc).not.toHaveProperty('secret')
    expect(doc).toHaveProperty('visible', 'shown')
  })

  it('keeps fields where access.read returns true', async () => {
    const rows = [{ id: '1', title: 'Hello', visible: 'shown' }]
    const { api } = setupWithAccess(rows)
    const result = await api.find({ collection: 'articles' })
    expect(result.isOk()).toBe(true)
    const docs = result._unsafeUnwrap() as Record<string, string | number | null>[]
    expect(docs[0]).toHaveProperty('visible', 'shown')
  })

  it('passes through fields without access config unchanged', async () => {
    const rows = [{ id: '1', title: 'Hello', noAccess: 'open' }]
    const { api } = setupWithAccess(rows)
    const result = await api.find({ collection: 'articles' })
    expect(result.isOk()).toBe(true)
    const docs = result._unsafeUnwrap() as Record<string, string | number | null>[]
    expect(docs[0]).toHaveProperty('noAccess', 'open')
    expect(docs[0]).toHaveProperty('title', 'Hello')
  })

  it('strips fields from create response', async () => {
    const inserted = { id: 'new-1', title: 'New', secret: 'hidden', visible: 'shown' }
    const { api } = setupWithAccess([inserted])
    const result = await api.create({ collection: 'articles', data: { title: 'New', secret: 'hidden', visible: 'shown' } })
    expect(result.isOk()).toBe(true)
    const doc = result._unsafeUnwrap() as Record<string, string | number | null>
    expect(doc).not.toHaveProperty('secret')
    expect(doc).toHaveProperty('visible', 'shown')
  })

  it('strips fields from update response', async () => {
    const updated = { id: '1', title: 'Updated', secret: 'hidden', visible: 'shown' }
    const { api } = setupWithAccess([updated])
    const result = await api.update({ collection: 'articles', id: '1', data: { title: 'Updated' } })
    expect(result.isOk()).toBe(true)
    const doc = result._unsafeUnwrap() as Record<string, string | number | null>
    expect(doc).not.toHaveProperty('secret')
    expect(doc).toHaveProperty('visible', 'shown')
  })
})

function setupWithWriteAccess (poolReturn: readonly Record<string, string | number | null>[] = []) {
  const pool = makeMockPool(poolReturn)
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'articles',
    fields: [
      field.text({ name: 'title', required: true }),
      field.text({ name: 'adminOnly', access: { create: () => false, update: () => false } }),
      field.text({ name: 'createOnly', access: { create: () => true, update: () => false } }),
      field.text({ name: 'noAccess' })
    ]
  }))
  const api = createLocalApi(pool, collections, globals)
  return { api, pool }
}

describe('field-level write filtering', () => {
  it('ignores fields where access.create returns false on create', async () => {
    const inserted = { id: 'new-1', title: 'New', noAccess: 'open' }
    const { api, pool } = setupWithWriteAccess([inserted])
    const result = await api.create({
      collection: 'articles',
      data: { title: 'New', adminOnly: 'secret', noAccess: 'open' }
    })
    expect(result.isOk()).toBe(true)
    // Verify the query was called without adminOnly
    const unsafeCalls = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls
    const insertCallArgs = JSON.stringify(unsafeCalls)
    expect(insertCallArgs).not.toContain('secret')
  })

  it('ignores fields where access.update returns false on update', async () => {
    const updated = { id: '1', title: 'Updated', noAccess: 'open' }
    const { api, pool } = setupWithWriteAccess([updated])
    const result = await api.update({
      collection: 'articles',
      id: '1',
      data: { title: 'Updated', adminOnly: 'secret', noAccess: 'open' }
    })
    expect(result.isOk()).toBe(true)
    const unsafeCalls = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls
    const updateCallArgs = JSON.stringify(unsafeCalls)
    expect(updateCallArgs).not.toContain('secret')
  })

  it('passes through non-access-controlled fields on create', async () => {
    const inserted = { id: 'new-1', title: 'New', noAccess: 'open' }
    const { api, pool } = setupWithWriteAccess([inserted])
    const result = await api.create({
      collection: 'articles',
      data: { title: 'New', noAccess: 'open' }
    })
    expect(result.isOk()).toBe(true)
    const unsafeCalls = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls
    const insertCallArgs = JSON.stringify(unsafeCalls)
    expect(insertCallArgs).toContain('open')
  })

  it('allows fields where access.create returns true on create', async () => {
    const inserted = { id: 'new-1', title: 'New', createOnly: 'allowed' }
    const { api, pool } = setupWithWriteAccess([inserted])
    const result = await api.create({
      collection: 'articles',
      data: { title: 'New', createOnly: 'allowed' }
    })
    expect(result.isOk()).toBe(true)
    const unsafeCalls = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls
    const insertCallArgs = JSON.stringify(unsafeCalls)
    expect(insertCallArgs).toContain('allowed')
  })

  it('blocks fields where access.update returns false even if create allows', async () => {
    const updated = { id: '1', title: 'Updated' }
    const { api, pool } = setupWithWriteAccess([updated])
    const result = await api.update({
      collection: 'articles',
      id: '1',
      data: { title: 'Updated', createOnly: 'blocked' }
    })
    expect(result.isOk()).toBe(true)
    const unsafeCalls = (pool.sql.unsafe as ReturnType<typeof vi.fn>).mock.calls
    const updateCallArgs = JSON.stringify(unsafeCalls)
    expect(updateCallArgs).not.toContain('blocked')
  })
})
