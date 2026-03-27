// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest'
import { store, field } from '../index.js'
import { SessionStateHolder } from '../server/session-state.js'
import { SSEBroadcaster } from '../server/sse-broadcaster.js'
import { registerStoreRoutes } from '../server/store-routes.js'
import { renderStoreFragment } from '../server/fragment-renderer.js'
import { renderStoreHydration } from '../server/hydration.js'
import { createStoreClient } from '../client/store-client.js'
import { readHydrationState } from '../client/hydration.js'
import { reconcileFragment } from '../client/fragment-reconciler.js'
import { effect } from '@valencets/reactive'
import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'
import type { StoreState } from '../types.js'
import { z } from 'zod'

function mockSSERes (): ServerResponse & { _written: string[] } {
  const emitter = new EventEmitter()
  const res = Object.assign(emitter, {
    _written: [] as string[],
    _headers: {} as { [key: string]: string },
    setHeader (name: string, value: string) { res._headers[name] = value },
    flushHeaders () {},
    write (chunk: string) { res._written.push(chunk); return true },
    end () {}
  })
  return res as ServerResponse & { _written: string[] }
}

describe('End-to-end: Signal Mode counter store', () => {
  it('full lifecycle — define, hydrate, mutate, reconcile', async () => {
    // 1. Define store
    const counterResult = store({
      slug: 'counter',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {
        increment: {
          input: [field.number({ name: 'amount' })],
          server: async ({ state, input }) => {
            state.count = (state.count as number) + (input.amount as number)
          },
          client: ({ state, input }) => {
            state.count = (state.count as number) + (input.amount as number)
          }
        }
      }
    })
    expect(counterResult.isOk()).toBe(true)
    const config = counterResult.unwrap()

    // 2. Server: create state holder and routes
    const holder = SessionStateHolder.create(config.fields)
    const broadcaster = SSEBroadcaster.create()
    const routes = registerStoreRoutes(config, holder, broadcaster)

    // 3. Server: render hydration for initial page
    const hydrationHtml = renderStoreHydration(config.slug, routes.getState('user-1'))
    expect(hydrationHtml).toContain('data-store-hydrate="counter"')

    // 4. Client: inject hydration HTML and read it
    const wrapper = document.createElement('div')
    wrapper.innerHTML = hydrationHtml
    const script = wrapper.querySelector('script')
    if (script) document.body.appendChild(script)
    const initialState = readHydrationState('counter')
    expect(initialState.count).toBe(0)

    // 5. Client: create store client with mock POST
    const mockPost = vi.fn().mockImplementation(async (_slug: string, mutation: string, args: StoreState, mutationId: number) => {
      const result = await routes.handleMutation('user-1', mutation, args as { [key: string]: string | number | boolean | null })
      if (result.isOk()) {
        return { ok: true, state: result.value.state, confirmedId: mutationId }
      }
      return { ok: false, error: { code: 'MUTATION_FAILED', message: 'Server error' } }
    })

    const client = createStoreClient(config, initialState, mockPost)

    // 6. Client: verify signals initialized
    expect(client.signals.count.value).toBe(0)

    // 7. Client: track reactive updates
    const reactiveValues: number[] = []
    effect(() => { reactiveValues.push(client.signals.count.value as number) })

    // 8. Client: call mutation — optimistic + server confirm
    const result = await client.mutations.increment({ amount: 5 })
    expect(result.isOk()).toBe(true)
    expect(client.signals.count.value).toBe(5)
    expect(reactiveValues).toContain(5)

    // 9. Client: second mutation
    await client.mutations.increment({ amount: 3 })
    expect(client.signals.count.value).toBe(8)

    // 10. Server state matches
    expect(routes.getState('user-1').count).toBe(8)

    // 11. Cleanup
    client.dispose()
    document.body.innerHTML = ''
  })
})

describe('End-to-end: Fragment Mode cart store', () => {
  it('full lifecycle — define, fragment render, mutation delegation, SSE swap', async () => {
    // 1. Define store with fragment render
    const cartResult = store({
      slug: 'cart',
      scope: 'session',
      fields: [
        field.array({
          name: 'items',
          fields: [
            field.text({ name: 'sku' }),
            field.text({ name: 'name' }),
            field.number({ name: 'price' })
          ]
        })
      ],
      mutations: {
        addItem: {
          input: [field.text({ name: 'sku' }), field.text({ name: 'name' }), field.number({ name: 'price' })],
          server: async ({ state, input }) => {
            const items = (state.items ?? []) as Array<{ sku: string; name: string; price: number }>
            items.push({ sku: input.sku as string, name: input.name as string, price: input.price as number })
            state.items = items
          }
        }
      },
      fragment: (state) => {
        const items = (state.items ?? []) as Array<{ name: string; price: number }>
        const list = items.map(i => `<li>${i.name} - $${i.price}</li>`).join('')
        return `<ul>${list}</ul><p>${items.length} item(s)</p>`
      }
    })
    expect(cartResult.isOk()).toBe(true)
    const config = cartResult.unwrap()

    // 2. Server setup
    const holder = SessionStateHolder.create(config.fields)
    const broadcaster = SSEBroadcaster.create()
    const routes = registerStoreRoutes(config, holder, broadcaster)

    // 3. Server: render initial fragment
    const initialState = routes.getState('user-1')
    const fragmentResult = renderStoreFragment(config, initialState)
    expect(fragmentResult.isOk()).toBe(true)
    const fragment = fragmentResult.unwrap()
    expect(fragment.html).toContain('0 item(s)')

    // 4. Client: set up fragment mode DOM
    const root = document.createElement('div')
    const storeEl = document.createElement('div')
    storeEl.setAttribute('data-store', 'cart')
    storeEl.setAttribute('data-store-mode', 'fragment')
    storeEl.innerHTML = fragment.html
    root.appendChild(storeEl)
    document.body.appendChild(root)

    // 5. Server: process mutation
    const mutationResult = await routes.handleMutation('user-1', 'addItem', {
      sku: 'WIDGET-1', name: 'Super Widget', price: 29.99
    })
    expect(mutationResult.isOk()).toBe(true)

    // 6. Server: render updated fragment
    const updatedState = routes.getState('user-1')
    const updatedFragment = renderStoreFragment(config, updatedState)
    expect(updatedFragment.isOk()).toBe(true)

    // 7. Client: swap fragment (simulating SSE event)
    reconcileFragment(updatedFragment.unwrap())

    // 8. Verify DOM updated
    expect(storeEl.innerHTML).toContain('Super Widget')
    expect(storeEl.innerHTML).toContain('$29.99')
    expect(storeEl.innerHTML).toContain('1 item(s)')

    // 9. SSE: verify broadcast to other clients
    const observerRes = mockSSERes()
    broadcaster.addClient('cart', 'observer', observerRes as ServerResponse)

    await routes.handleMutation('user-1', 'addItem', {
      sku: 'GADGET-1', name: 'Mega Gadget', price: 49.99
    })

    expect(observerRes._written).toHaveLength(1)
    expect(observerRes._written[0]).toContain('"items"')

    // 10. Cleanup
    document.body.innerHTML = ''
  })
})

describe('End-to-end: Concurrent mutations (replay path)', () => {
  it('two concurrent optimistic increments reconcile correctly', async () => {
    const counterResult = store({
      slug: 'concurrent',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {
        increment: {
          input: [field.number({ name: 'amount' })],
          server: async ({ state, input }) => {
            state.count = (state.count as number) + (input.amount as number)
          },
          client: ({ state, input }) => {
            state.count = (state.count as number) + (input.amount as number)
          }
        }
      }
    })
    const config = counterResult.unwrap()
    const holder = SessionStateHolder.create(config.fields)
    const broadcaster = SSEBroadcaster.create()
    const routes = registerStoreRoutes(config, holder, broadcaster)

    const mockPost = vi.fn().mockImplementation(async (_s: string, mutation: string, args: StoreState, mutationId: number) => {
      const result = await routes.handleMutation('user-1', mutation, args as { [key: string]: string | number | boolean | null })
      if (result.isOk()) return { ok: true, state: result.value.state, confirmedId: mutationId }
      return { ok: false, error: { code: 'FAILED', message: 'err' } }
    })

    const client = createStoreClient(config, { count: 0 }, mockPost)
    expect(client.signals.count.value).toBe(0)

    // Fire two mutations concurrently — both start before either POST returns
    const p1 = client.mutations.increment({ amount: 5 })
    const p2 = client.mutations.increment({ amount: 3 })

    // After synchronous optimistic applies: 0 + 5 = 5 (p1), 5 + 3 = 8 (p2)
    expect(client.signals.count.value).toBe(8)

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1.isOk()).toBe(true)
    expect(r2.isOk()).toBe(true)

    // Server processed sequentially via session lock: 0+5=5, 5+3=8
    // After reconciliation: final = 8
    expect(client.signals.count.value).toBe(8)
    expect(routes.getState('user-1').count).toBe(8)

    client.dispose()
  })
})

describe('End-to-end: Server rejection rollback', () => {
  it('rolls back optimistic state on server failure', async () => {
    const counterResult = store({
      slug: 'rollback',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {
        increment: {
          input: [field.number({ name: 'amount' })],
          server: async ({ state, input }) => {
            state.count = (state.count as number) + (input.amount as number)
          },
          client: ({ state, input }) => {
            state.count = (state.count as number) + (input.amount as number)
          }
        }
      }
    })
    const config = counterResult.unwrap()
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    let callCount = 0
    const mockPost = vi.fn().mockImplementation(async (_s: string, mutation: string, args: StoreState, mutationId: number) => {
      callCount++
      // First call succeeds, second call fails
      if (callCount === 2) {
        return { ok: false, error: { code: 'MUTATION_FAILED', message: 'Server rejected' } }
      }
      const result = await routes.handleMutation('user-1', mutation, args as { [key: string]: string | number | boolean | null })
      if (result.isOk()) return { ok: true, state: result.value.state, confirmedId: mutationId }
      return { ok: false, error: { code: 'FAILED', message: 'err' } }
    })

    const client = createStoreClient(config, { count: 0 }, mockPost)

    // First mutation succeeds
    const r1 = await client.mutations.increment({ amount: 10 })
    expect(r1.isOk()).toBe(true)
    expect(client.signals.count.value).toBe(10)

    // Second mutation: optimistic goes to 15, server rejects → rollback to 10
    const r2 = await client.mutations.increment({ amount: 5 })
    expect(r2.isErr()).toBe(true)
    expect(client.signals.count.value).toBe(10)

    // Server state unaffected
    expect(routes.getState('user-1').count).toBe(10)

    client.dispose()
  })
})

describe('End-to-end: Validation failure', () => {
  it('rejects invalid input without touching signals or server', async () => {
    const counterResult = store({
      slug: 'validate',
      scope: 'session',
      fields: [field.number({ name: 'count', default: 0 })],
      mutations: {
        increment: {
          input: [field.number({ name: 'amount' })],
          server: async ({ state, input }) => {
            state.count = (state.count as number) + (input.amount as number)
          }
        }
      }
    })
    const config = counterResult.unwrap()

    const mockPost = vi.fn()
    const client = createStoreClient(config, { count: 0 }, mockPost)

    // Pass string instead of number — Zod rejects
    const result = await client.mutations.increment({ amount: 'not-a-number' as unknown as number })
    expect(result.isErr()).toBe(true)

    // Signal unchanged, server never called
    expect(client.signals.count.value).toBe(0)
    expect(mockPost).not.toHaveBeenCalled()

    client.dispose()
  })
})

describe('End-to-end: Custom field types', () => {
  it('custom validator flows through store lifecycle', async () => {
    const vec2Schema = z.object({ x: z.number(), y: z.number() })
    const gameResult = store({
      slug: 'game',
      scope: 'session',
      fields: [
        field.custom({ name: 'position', validator: vec2Schema, default: { x: 0, y: 0 } }),
        field.number({ name: 'health', default: 100 })
      ],
      mutations: {
        move: {
          input: [field.custom({ name: 'delta', validator: vec2Schema })],
          server: async ({ state, input }) => {
            const pos = state.position as { x: number; y: number }
            const delta = input.delta as { x: number; y: number }
            state.position = { x: pos.x + delta.x, y: pos.y + delta.y }
          }
        }
      }
    })
    expect(gameResult.isOk()).toBe(true)
    const config = gameResult.unwrap()

    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    const mockPost = vi.fn().mockImplementation(async (_s: string, mutation: string, args: StoreState, mutationId: number) => {
      const result = await routes.handleMutation('player-1', mutation, args as { [key: string]: string | number | boolean | null })
      if (result.isOk()) return { ok: true, state: result.value.state, confirmedId: mutationId }
      return { ok: false, error: { code: 'FAILED', message: 'err' } }
    })

    const client = createStoreClient(config, { position: { x: 0, y: 0 }, health: 100 }, mockPost)

    expect(client.signals.position.value).toEqual({ x: 0, y: 0 })

    await client.mutations.move({ delta: { x: 10, y: 5 } })
    expect(client.signals.position.value).toEqual({ x: 10, y: 5 })

    await client.mutations.move({ delta: { x: -3, y: 2 } })
    expect(client.signals.position.value).toEqual({ x: 7, y: 7 })

    expect(routes.getState('player-1').position).toEqual({ x: 7, y: 7 })

    client.dispose()
  })
})
