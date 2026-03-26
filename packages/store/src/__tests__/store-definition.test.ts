import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { store } from '../index.js'
import { field } from '../fields/index.js'
import { StoreScope, StoreErrorCode } from '../types.js'

describe('StoreScope', () => {
  it('contains all expected scopes', () => {
    expect(StoreScope.PAGE).toBe('page')
    expect(StoreScope.SESSION).toBe('session')
    expect(StoreScope.USER).toBe('user')
    expect(StoreScope.GLOBAL).toBe('global')
  })

  it('is frozen', () => {
    expect(Object.isFrozen(StoreScope)).toBe(true)
  })
})

describe('StoreErrorCode', () => {
  it('contains expected error codes', () => {
    expect(StoreErrorCode.INVALID_SLUG).toBe('INVALID_SLUG')
    expect(StoreErrorCode.DUPLICATE_FIELD).toBe('DUPLICATE_FIELD')
    expect(StoreErrorCode.INVALID_MUTATION).toBe('INVALID_MUTATION')
    expect(StoreErrorCode.MUTATION_FAILED).toBe('MUTATION_FAILED')
    expect(StoreErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED')
  })

  it('is frozen', () => {
    expect(Object.isFrozen(StoreErrorCode)).toBe(true)
  })
})

describe('store', () => {
  it('returns Ok with valid config', () => {
    const result = store({
      slug: 'counter',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {}
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.slug).toBe('counter')
      expect(result.value.scope).toBe('session')
      expect(result.value.fields).toHaveLength(1)
    }
  })

  it('returns Ok with mutations', () => {
    const result = store({
      slug: 'cart',
      scope: 'session',
      fields: [
        field.array({
          name: 'items',
          fields: [
            field.text({ name: 'sku' }),
            field.number({ name: 'qty' })
          ]
        })
      ],
      mutations: {
        addItem: {
          input: [field.text({ name: 'sku' }), field.number({ name: 'qty' })],
          server: async ({ state, input }) => {
            // placeholder
          }
        }
      }
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.mutations.addItem).toBeDefined()
      expect(result.value.mutations.addItem!.input).toHaveLength(2)
    }
  })

  it('returns Ok with fragment render function', () => {
    const result = store({
      slug: 'counter',
      scope: 'global',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {},
      fragment: (state) => `<p>Count: ${String(state.count)}</p>`
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.fragment).toBeDefined()
    }
  })

  it('returns Ok with derived fields', () => {
    const result = store({
      slug: 'cart',
      scope: 'session',
      fields: [
        field.array({
          name: 'items',
          fields: [field.number({ name: 'price' })]
        })
      ],
      mutations: {},
      derived: {
        total: (state) => 0,
        isEmpty: (state) => true
      }
    })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.derived).toBeDefined()
      expect(result.value.derived!.total).toBeDefined()
      expect(result.value.derived!.isEmpty).toBeDefined()
    }
  })

  it('returns Ok with custom field types', () => {
    const result = store({
      slug: 'game',
      scope: 'session',
      fields: [
        field.custom({
          name: 'position',
          validator: z.object({ x: z.number(), y: z.number() }),
          default: { x: 0, y: 0 }
        })
      ],
      mutations: {}
    })
    expect(result.isOk()).toBe(true)
  })

  it('rejects invalid slug format', () => {
    const result = store({
      slug: 'INVALID SLUG',
      scope: 'session',
      fields: [field.text({ name: 'x' })],
      mutations: {}
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_SLUG)
    }
  })

  it('rejects slug starting with number', () => {
    const result = store({
      slug: '1counter',
      scope: 'session',
      fields: [field.text({ name: 'x' })],
      mutations: {}
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_SLUG)
    }
  })

  it('rejects empty slug', () => {
    const result = store({
      slug: '',
      scope: 'session',
      fields: [field.text({ name: 'x' })],
      mutations: {}
    })
    expect(result.isErr()).toBe(true)
  })

  it('rejects duplicate field names', () => {
    const result = store({
      slug: 'test',
      scope: 'session',
      fields: [
        field.text({ name: 'title' }),
        field.text({ name: 'title' })
      ],
      mutations: {}
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.DUPLICATE_FIELD)
    }
  })

  it('rejects empty fields array', () => {
    const result = store({
      slug: 'empty',
      scope: 'session',
      fields: [],
      mutations: {}
    })
    expect(result.isErr()).toBe(true)
  })

  it('rejects mutation with no server function', () => {
    const result = store({
      slug: 'test',
      scope: 'session',
      fields: [field.text({ name: 'x' })],
      mutations: {
        broken: {
          input: [],
          server: undefined as never
        }
      }
    })
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_MUTATION)
    }
  })

  it('accepts all four scopes', () => {
    for (const scope of ['page', 'session', 'user', 'global'] as const) {
      const result = store({
        slug: `test-${scope}`,
        scope,
        fields: [field.text({ name: 'x' })],
        mutations: {}
      })
      expect(result.isOk()).toBe(true)
    }
  })

  it('mutations with client function accepted', () => {
    const result = store({
      slug: 'cart',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {
        increment: {
          input: [field.number({ name: 'amount' })],
          server: async ({ state, input }) => {},
          client: ({ state, input }) => {}
        }
      }
    })
    expect(result.isOk()).toBe(true)
  })
})
