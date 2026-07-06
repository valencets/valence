import { describe, it, expect } from 'vitest'
import { generateStoreModule } from '../codegen/store-generator.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import type { StoreDefinition } from '../types.js'

function makeCounterConfig (): StoreDefinition {
  const result = store({
    slug: 'counter',
    scope: 'session',
    fields: [field.number({ name: 'count', default: 0 })],
    mutations: {
      increment: {
        input: [field.number({ name: 'amount' })],
        server: async ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        }
      },
      reset: {
        input: [],
        server: async ({ state }) => { state.count = 0 }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

function makeCartConfig (): StoreDefinition {
  const result = store({
    slug: 'cart',
    scope: 'session',
    fields: [
      field.array({
        name: 'items',
        fields: [
          field.text({ name: 'sku' }),
          field.number({ name: 'qty' }),
          field.number({ name: 'price' })
        ]
      }),
      field.text({ name: 'couponCode' }),
      field.select({ name: 'status', options: ['open', 'checkout', 'paid'], default: 'open' }),
      field.boolean({ name: 'express', default: false })
    ],
    mutations: {
      addItem: {
        input: [field.text({ name: 'sku' }), field.number({ name: 'qty' }), field.number({ name: 'price' })],
        server: async () => {}
      },
      removeItem: {
        input: [field.text({ name: 'sku' })],
        server: async () => {}
      },
      checkout: {
        input: [],
        server: async () => {}
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

describe('generateStoreModule', () => {
  it('generates a valid TypeScript module string', () => {
    const config = makeCounterConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('// @generated')
    expect(code).toContain('DO NOT EDIT')
  })

  it('includes typed signal interface for fields', () => {
    const config = makeCounterConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('count')
    expect(code).toContain('number')
  })

  it('includes mutation function types', () => {
    const config = makeCounterConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('increment')
    expect(code).toContain('reset')
    expect(code).toContain('amount')
  })

  it('generates correct types for array fields', () => {
    const config = makeCartConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('items')
    expect(code).toContain('Array')
    expect(code).toContain('sku')
    expect(code).toContain('qty')
    expect(code).toContain('price')
  })

  it('generates correct types for select fields', () => {
    const config = makeCartConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('status')
    expect(code).toContain("'open'")
    expect(code).toContain("'checkout'")
    expect(code).toContain("'paid'")
  })

  it('generates correct types for boolean fields', () => {
    const config = makeCartConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('express')
    expect(code).toContain('boolean')
  })

  it('includes store slug in output', () => {
    const config = makeCounterConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('counter')
  })

  it('includes Result import for mutation return types', () => {
    const config = makeCounterConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('Result')
  })

  it('generates mutation input types', () => {
    const config = makeCartConfig()
    const code = generateStoreModule(config)
    // addItem takes sku, qty, price
    expect(code).toContain('addItem')
    expect(code).toContain('removeItem')
    expect(code).toContain('checkout')
  })

  it('generates export for the store object', () => {
    const config = makeCounterConfig()
    const code = generateStoreModule(config)
    expect(code).toContain('export')
  })
})
