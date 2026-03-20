import { describe, it, expect, vi } from 'vitest'
import { ValElement } from '../core/val-element.js'
import { createEntityStore } from '../entity-store.js'
import type { EntityStore, EntityData } from '../entity-store.js'

// --- Test element that uses watchEntity ---

let tagCounter = 0

function createTestClass (): typeof ValElement & { new (): InstanceType<typeof ValElement> & { lastEntity: EntityData | null, watchCount: number } } {
  const cls = class TestEntityElement extends ValElement {
    lastEntity: EntityData | null = null
    watchCount = 0

    protected createTemplate (): HTMLTemplateElement {
      return document.createElement('template')
    }

    connectToStore (store: EntityStore, id: string): void {
      this.watchEntity(store, id, (entity) => {
        this.lastEntity = entity
        this.watchCount++
      })
    }
  }
  const tag = `test-entity-el-${++tagCounter}`
  customElements.define(tag, cls)
  return cls as ReturnType<typeof createTestClass>
}

function createElement (Cls: ReturnType<typeof createTestClass>): InstanceType<ReturnType<typeof createTestClass>> {
  const tag = customElements.getName(Cls)!
  return document.createElement(tag) as InstanceType<ReturnType<typeof createTestClass>>
}

describe('ValElement.watchEntity()', () => {
  it('receives patches while connected', () => {
    const Cls = createTestClass()
    const el = createElement(Cls)
    const store = createEntityStore('items')

    el.connectToStore(store, 'id-1')
    document.body.appendChild(el)

    store.patch('id-1', { liked: true })
    expect(el.lastEntity).toEqual({ liked: true })
    expect(el.watchCount).toBe(1)

    document.body.removeChild(el)
  })

  it('auto-unsubscribes on disconnectedCallback', () => {
    const Cls = createTestClass()
    const el = createElement(Cls)
    const store = createEntityStore('items')

    el.connectToStore(store, 'id-1')
    document.body.appendChild(el)

    store.patch('id-1', { count: 1 })
    expect(el.watchCount).toBe(1)

    document.body.removeChild(el)

    store.patch('id-1', { count: 2 })
    expect(el.watchCount).toBe(1) // no further notifications
  })

  it('re-subscribes on re-connect', () => {
    const Cls = createTestClass()
    const el = createElement(Cls)
    const store = createEntityStore('items')

    el.connectToStore(store, 'id-1')
    document.body.appendChild(el)

    store.patch('id-1', { count: 1 })
    expect(el.watchCount).toBe(1)

    document.body.removeChild(el)
    document.body.appendChild(el)

    store.patch('id-1', { count: 2 })
    expect(el.watchCount).toBe(2)

    document.body.removeChild(el)
  })

  it('supports multiple watchers on same element', () => {
    const Cls = createTestClass()
    const el = createElement(Cls)
    const store1 = createEntityStore('posts')
    const store2 = createEntityStore('users')
    const cb2 = vi.fn()

    // Override to add a second watcher
    const origConnect = el.connectToStore.bind(el)
    el.connectToStore = (store: EntityStore, id: string) => {
      origConnect(store, id)
      ;(el as InstanceType<typeof ValElement> & { watchEntity: (s: EntityStore, i: string, cb: (e: EntityData) => void) => void }).watchEntity(store2, 'user-1', cb2)
    }

    el.connectToStore(store1, 'post-1')
    document.body.appendChild(el)

    store1.patch('post-1', { title: 'Hello' })
    store2.patch('user-1', { name: 'Alice' })

    expect(el.lastEntity).toEqual({ title: 'Hello' })
    expect(cb2).toHaveBeenCalledWith({ name: 'Alice' })

    document.body.removeChild(el)

    // Both should be cleaned up
    store1.patch('post-1', { title: 'Bye' })
    store2.patch('user-1', { name: 'Bob' })
    expect(el.watchCount).toBe(1)
    expect(cb2).toHaveBeenCalledTimes(1)
  })
})
