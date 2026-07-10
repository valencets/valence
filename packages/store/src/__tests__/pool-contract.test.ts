import { describe, it, expect, vi } from 'vitest'
import { PostgresStateHolder } from '../server/pg-state-holder.js'
import { SessionStateHolder } from '../server/session-state.js'
import { handleMutation } from '../server/mutation-handler.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import type { StoreDefinition } from '../types.js'

// #333 — the mutation pool contract is query(text, params?): parameter
// binding is a first-class array argument, so mutation server fns are never
// structurally forced to interpolate values into SQL strings. Params carry
// scalars (string | number | boolean | null), not just strings.

const FIELDS = [field.number({ name: 'count', default: 7 }), field.text({ name: 'theme' })]

describe('pool contract — PostgresStateHolder issues query(text, params)', () => {
  it('getState binds slug and key as one params array, not variadic string arguments', async () => {
    const query = vi.fn(async () => [])
    const holder = PostgresStateHolder.create({ pool: { query }, slug: 'prefs', fields: FIELDS })

    await holder.getState('user:u1')

    expect(query).toHaveBeenCalledTimes(1)
    const call = query.mock.calls[0]! as unknown as readonly unknown[]
    expect(call).toHaveLength(2)
    const [text, params] = call as [string, readonly unknown[]]
    expect(text).toContain('store_states')
    expect(text).toContain('$1')
    expect(params).toEqual(['prefs', 'user:u1'])
  })

  it('setState binds slug, key, and serialized state as one params array', async () => {
    const query = vi.fn(async () => [])
    const holder = PostgresStateHolder.create({ pool: { query }, slug: 'prefs', fields: FIELDS })

    await holder.setState('user:u1', { count: 3, theme: 'light' })

    expect(query).toHaveBeenCalledTimes(1)
    const call = query.mock.calls[0]! as unknown as readonly unknown[]
    expect(call).toHaveLength(2)
    const [text, params] = call as [string, readonly string[]]
    expect(text).toContain('INSERT INTO')
    expect(text).not.toContain('user:u1')
    expect(params[0]).toBe('prefs')
    expect(params[1]).toBe('user:u1')
    expect(JSON.parse(params[2]!)).toEqual({ count: 3, theme: 'light' })
  })
})

describe('pool contract — mutation server fns bind typed params', () => {
  function lookupStore (): StoreDefinition {
    const result = store({
      slug: 'catalog',
      scope: 'session',
      fields: [field.number({ name: 'price', default: 0 })],
      mutations: {
        lookup: {
          input: [field.text({ name: 'sku', required: true })],
          server: async ({ state, input, pool }) => {
            // The contract must let non-string scalars ride as params —
            // numbers, booleans, and null must survive untouched.
            const rows = await pool.query(
              'SELECT price FROM products WHERE sku = $1 AND qty > $2 AND active = $3 AND discontinued_at IS NOT DISTINCT FROM $4',
              [String(input.sku), 2, true, null]
            )
            state.price = (rows[0] as { price: number }).price
          }
        }
      }
    })
    if (result.isErr()) return undefined as never
    return result.value
  }

  it('passes (text, params) through to the pool with scalar types preserved', async () => {
    const query = vi.fn(async () => [{ price: 9.99 }])
    const config = lookupStore()
    const holder = SessionStateHolder.create(config.fields)

    const result = await handleMutation(
      config, holder, 'sess-1', 'lookup', { sku: 'abc' }, { query }, { id: 'sess-1' }
    )

    expect(result.isOk()).toBe(true)
    expect(query).toHaveBeenCalledTimes(1)
    expect(query).toHaveBeenCalledWith(
      'SELECT price FROM products WHERE sku = $1 AND qty > $2 AND active = $3 AND discontinued_at IS NOT DISTINCT FROM $4',
      ['abc', 2, true, null]
    )
    if (result.isOk()) {
      expect(result.value.state.price).toBe(9.99)
    }
  })

  it('supports parameterless queries — params argument stays optional', async () => {
    const query = vi.fn(async () => [{ price: 1 }])
    const result = store({
      slug: 'plain',
      scope: 'session',
      fields: [field.number({ name: 'price', default: 0 })],
      mutations: {
        scan: {
          input: [],
          server: async ({ state, pool }) => {
            const rows = await pool.query('SELECT price FROM products LIMIT 1')
            state.price = (rows[0] as { price: number }).price
          }
        }
      }
    })
    if (result.isErr()) return
    const holder = SessionStateHolder.create(result.value.fields)

    const outcome = await handleMutation(
      result.value, holder, 'sess-1', 'scan', {}, { query }, { id: 'sess-1' }
    )

    expect(outcome.isOk()).toBe(true)
    expect(query).toHaveBeenCalledWith('SELECT price FROM products LIMIT 1')
  })
})
