import { describe, it, expect } from 'vitest'
import { renderStoreFragment } from '../server/fragment-renderer.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import type { StoreDefinition } from '../types.js'

function makeCounterStore (): StoreDefinition {
  const result = store({
    slug: 'counter',
    scope: 'session',
    fields: [field.number({ name: 'count', default: 0 })],
    mutations: {},
    fragment: (state) => `<p>Count: <span>${String(state.count)}</span></p>`
  })
  if (result.isErr()) return undefined as never
  return result.value
}

function makeCartStore (): StoreDefinition {
  const result = store({
    slug: 'cart',
    scope: 'session',
    fields: [
      field.array({
        name: 'items',
        fields: [field.text({ name: 'name' }), field.number({ name: 'price' })]
      })
    ],
    mutations: {},
    fragment: (state) => {
      const items = (state.items ?? []) as Array<{ name: string; price: number }>
      const list = items.map(i => `<li>${i.name} - $${i.price}</li>`).join('')
      return `<ul>${list}</ul><p>${items.length} items</p>`
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

describe('renderStoreFragment', () => {
  it('calls fragment function with state and returns HTML', () => {
    const config = makeCounterStore()
    const result = renderStoreFragment(config, { count: 42 })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.html).toBe('<p>Count: <span>42</span></p>')
      expect(result.value.selector).toBe('[data-store="counter"]')
    }
  })

  it('renders complex HTML from array state', () => {
    const config = makeCartStore()
    const result = renderStoreFragment(config, {
      items: [
        { name: 'Widget', price: 9.99 },
        { name: 'Gadget', price: 24.99 }
      ]
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.html).toContain('<li>Widget - $9.99</li>')
      expect(result.value.html).toContain('<li>Gadget - $24.99</li>')
      expect(result.value.html).toContain('2 items')
    }
  })

  it('returns Err when store has no fragment function', () => {
    const result = store({
      slug: 'no-frag',
      scope: 'session',
      fields: [field.text({ name: 'x' })],
      mutations: {}
    })
    if (result.isErr()) return
    const config = result.value

    const renderResult = renderStoreFragment(config, { x: 'test' })
    expect(renderResult.isErr()).toBe(true)
  })

  it('returns Err when fragment function throws', () => {
    const result = store({
      slug: 'bad-frag',
      scope: 'session',
      fields: [field.text({ name: 'x' })],
      mutations: {},
      fragment: () => {
        const arr: number[] = []
        return arr[0]!.toString()
      }
    })
    if (result.isErr()) return
    const config = result.value

    const renderResult = renderStoreFragment(config, { x: 'test' })
    expect(renderResult.isErr()).toBe(true)
  })

  it('selector uses store slug', () => {
    const config = makeCounterStore()
    const result = renderStoreFragment(config, { count: 0 })
    if (result.isOk()) {
      expect(result.value.selector).toBe('[data-store="counter"]')
    }
  })

  it('renders with empty state', () => {
    const config = makeCartStore()
    const result = renderStoreFragment(config, {})
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.html).toContain('0 items')
    }
  })
})
