import { describe, it, expect } from 'vitest'
import { createEntityStore } from '../index.js'
import type { EntityStore, EntityData } from '../index.js'

describe('entity-store public exports', () => {
  it('createEntityStore is exported from package index', () => {
    expect(typeof createEntityStore).toBe('function')
  })

  it('EntityStore type is usable via index', () => {
    const store: EntityStore = createEntityStore('test')
    expect(store.name).toBe('test')
  })

  it('EntityData type is usable via index', () => {
    const data: EntityData = { name: 'Alice', age: 30, active: true, score: null }
    const store = createEntityStore('test')
    store.patch('id-1', data)
    expect(store.get('id-1')).toEqual(data)
  })
})
