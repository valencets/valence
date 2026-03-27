import { describe, it, expect, beforeEach } from 'vitest'
import { z } from 'zod'
import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'
import { store } from '../index.js'
import { field } from '../fields/index.js'
import { SessionStateHolder } from '../server/session-state.js'
import { SSEBroadcaster } from '../server/sse-broadcaster.js'
import { registerStoreRoutes } from '../server/store-routes.js'
import type { StoreDefinition, StoreState } from '../types.js'

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

// --- Cart Store: arrays of objects, nested groups, multiple mutations ---

function makeCartStore (): StoreDefinition {
  const result = store({
    slug: 'cart',
    scope: 'session',
    fields: [
      field.array({
        name: 'items',
        fields: [
          field.text({ name: 'sku' }),
          field.text({ name: 'name' }),
          field.number({ name: 'qty' }),
          field.number({ name: 'price' })
        ]
      }),
      field.text({ name: 'couponCode' }),
      field.select({ name: 'status', options: ['open', 'checkout', 'paid'], default: 'open' })
    ],
    mutations: {
      addItem: {
        input: [
          field.text({ name: 'sku' }),
          field.text({ name: 'name' }),
          field.number({ name: 'qty' }),
          field.number({ name: 'price' })
        ],
        server: async ({ state, input }) => {
          const items = (state.items ?? []) as Array<{ sku: string; name: string; qty: number; price: number }>
          items.push({
            sku: input.sku as string,
            name: input.name as string,
            qty: input.qty as number,
            price: input.price as number
          })
          state.items = items
        }
      },
      removeItem: {
        input: [field.text({ name: 'sku' })],
        server: async ({ state, input }) => {
          const items = (state.items ?? []) as Array<{ sku: string }>
          state.items = items.filter(i => i.sku !== input.sku)
        }
      },
      updateQty: {
        input: [field.text({ name: 'sku' }), field.number({ name: 'qty', min: 1 })],
        server: async ({ state, input }) => {
          const items = (state.items ?? []) as Array<{ sku: string; qty: number }>
          const item = items.find(i => i.sku === input.sku)
          if (item) item.qty = input.qty as number
          state.items = items
        }
      },
      applyCoupon: {
        input: [field.text({ name: 'code', minLength: 3 })],
        server: async ({ state, input }) => {
          state.couponCode = input.code as string
        }
      },
      checkout: {
        input: [],
        server: async ({ state }) => {
          state.status = 'checkout'
        }
      },
      clear: {
        input: [],
        server: async ({ state }) => {
          state.items = []
          state.couponCode = undefined
          state.status = 'open'
        }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

// --- User Preferences Store: mixed field types, custom fields ---

function makePrefsStore (): StoreDefinition {
  const result = store({
    slug: 'prefs',
    scope: 'session',
    fields: [
      field.text({ name: 'displayName' }),
      field.email({ name: 'email' }),
      field.url({ name: 'avatar' }),
      field.color({ name: 'accentColor', default: '#3b82f6' }),
      field.boolean({ name: 'darkMode', default: false }),
      field.multiselect({ name: 'notifications', options: ['email', 'sms', 'push'] }),
      field.select({ name: 'language', options: ['en', 'es', 'fr', 'de'], default: 'en' }),
      field.custom({
        name: 'layout',
        validator: z.object({
          sidebar: z.enum(['left', 'right', 'hidden']),
          density: z.enum(['compact', 'comfortable', 'spacious'])
        }),
        default: { sidebar: 'left', density: 'comfortable' }
      })
    ],
    mutations: {
      updateProfile: {
        input: [
          field.text({ name: 'displayName' }),
          field.email({ name: 'email' }),
          field.url({ name: 'avatar' })
        ],
        server: async ({ state, input }) => {
          state.displayName = input.displayName
          state.email = input.email
          state.avatar = input.avatar
        }
      },
      toggleDarkMode: {
        input: [],
        server: async ({ state }) => {
          state.darkMode = !(state.darkMode as boolean)
        }
      },
      setNotifications: {
        input: [field.multiselect({ name: 'channels', options: ['email', 'sms', 'push'] })],
        server: async ({ state, input }) => {
          state.notifications = input.channels
        }
      },
      setLayout: {
        input: [field.custom({
          name: 'layout',
          validator: z.object({
            sidebar: z.enum(['left', 'right', 'hidden']),
            density: z.enum(['compact', 'comfortable', 'spacious'])
          })
        })],
        server: async ({ state, input }) => {
          state.layout = input.layout
        }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

describe('Cart Store — real-world array mutations', () => {
  let config: StoreDefinition
  let holder: SessionStateHolder
  let broadcaster: SSEBroadcaster

  beforeEach(() => {
    config = makeCartStore()
    holder = SessionStateHolder.create(config.fields)
    broadcaster = SSEBroadcaster.create()
  })

  it('addItem pushes object into items array', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'addItem', { sku: 'WIDGET-1', name: 'Widget', qty: 2, price: 9.99 })

    const state = routes.getState('s1')
    const items = state.items as Array<{ sku: string; name: string; qty: number; price: number }>
    expect(items).toHaveLength(1)
    expect(items[0]!.sku).toBe('WIDGET-1')
    expect(items[0]!.qty).toBe(2)
    expect(items[0]!.price).toBe(9.99)
  })

  it('multiple addItem calls accumulate', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'addItem', { sku: 'A', name: 'Alpha', qty: 1, price: 5 })
    await routes.handleMutation('s1', 'addItem', { sku: 'B', name: 'Beta', qty: 3, price: 12 })
    await routes.handleMutation('s1', 'addItem', { sku: 'C', name: 'Gamma', qty: 1, price: 25 })

    const items = routes.getState('s1').items as Array<{ sku: string }>
    expect(items).toHaveLength(3)
    expect(items.map(i => i.sku)).toEqual(['A', 'B', 'C'])
  })

  it('removeItem filters by sku', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'addItem', { sku: 'A', name: 'Alpha', qty: 1, price: 5 })
    await routes.handleMutation('s1', 'addItem', { sku: 'B', name: 'Beta', qty: 1, price: 10 })
    await routes.handleMutation('s1', 'removeItem', { sku: 'A' })

    const items = routes.getState('s1').items as Array<{ sku: string }>
    expect(items).toHaveLength(1)
    expect(items[0]!.sku).toBe('B')
  })

  it('updateQty modifies nested item property', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'addItem', { sku: 'X', name: 'X', qty: 1, price: 10 })
    await routes.handleMutation('s1', 'updateQty', { sku: 'X', qty: 5 })

    const items = routes.getState('s1').items as Array<{ sku: string; qty: number }>
    expect(items[0]!.qty).toBe(5)
  })

  it('updateQty rejects qty below min', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'addItem', { sku: 'X', name: 'X', qty: 1, price: 10 })
    const result = await routes.handleMutation('s1', 'updateQty', { sku: 'X', qty: 0 })
    expect(result.isErr()).toBe(true)
  })

  it('applyCoupon sets string field', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'applyCoupon', { code: 'SAVE20' })
    expect(routes.getState('s1').couponCode).toBe('SAVE20')
  })

  it('applyCoupon rejects short code', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const result = await routes.handleMutation('s1', 'applyCoupon', { code: 'AB' })
    expect(result.isErr()).toBe(true)
  })

  it('checkout changes status field', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'checkout', {})
    expect(routes.getState('s1').status).toBe('checkout')
  })

  it('clear resets multiple fields at once', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('s1', 'addItem', { sku: 'A', name: 'A', qty: 1, price: 5 })
    await routes.handleMutation('s1', 'applyCoupon', { code: 'DEAL' })
    await routes.handleMutation('s1', 'checkout', {})
    await routes.handleMutation('s1', 'clear', {})

    const state = routes.getState('s1')
    expect(state.items).toEqual([])
    expect(state.couponCode).toBeUndefined()
    expect(state.status).toBe('open')
  })

  it('SSE broadcasts full cart state after addItem', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const sseRes = mockSSERes()
    broadcaster.addClient('cart', 'observer', sseRes as ServerResponse)

    await routes.handleMutation('mutator', 'addItem', { sku: 'Z', name: 'Zeta', qty: 1, price: 42 })

    expect(sseRes._written).toHaveLength(1)
    const payload = JSON.parse(sseRes._written[0]!.split('\n')[1]!.replace('data: ', '')) as StoreState
    const items = payload.items as Array<{ sku: string }>
    expect(items).toHaveLength(1)
    expect(items[0]!.sku).toBe('Z')
  })

  it('sessions are isolated — different carts', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    await routes.handleMutation('user-1', 'addItem', { sku: 'A', name: 'A', qty: 1, price: 5 })
    await routes.handleMutation('user-2', 'addItem', { sku: 'B', name: 'B', qty: 1, price: 10 })

    const cart1 = routes.getState('user-1').items as Array<{ sku: string }>
    const cart2 = routes.getState('user-2').items as Array<{ sku: string }>
    expect(cart1).toHaveLength(1)
    expect(cart1[0]!.sku).toBe('A')
    expect(cart2).toHaveLength(1)
    expect(cart2[0]!.sku).toBe('B')
  })
})

describe('User Preferences Store — mixed types, custom fields', () => {
  let config: StoreDefinition
  let holder: SessionStateHolder

  beforeEach(() => {
    config = makePrefsStore()
    holder = SessionStateHolder.create(config.fields)
  })

  it('defaults initialize correctly for mixed field types', () => {
    const routes = registerStoreRoutes(config, holder)
    const state = routes.getState('s1')

    expect(state.displayName).toBeUndefined()
    expect(state.email).toBeUndefined()
    expect(state.accentColor).toBe('#3b82f6')
    expect(state.darkMode).toBe(false)
    expect(state.notifications).toBeUndefined()
    expect(state.language).toBe('en')
    expect(state.layout).toEqual({ sidebar: 'left', density: 'comfortable' })
  })

  it('updateProfile sets multiple string fields', async () => {
    const routes = registerStoreRoutes(config, holder)
    await routes.handleMutation('s1', 'updateProfile', {
      displayName: 'Alice',
      email: 'alice@example.com',
      avatar: 'https://example.com/alice.jpg'
    })

    const state = routes.getState('s1')
    expect(state.displayName).toBe('Alice')
    expect(state.email).toBe('alice@example.com')
    expect(state.avatar).toBe('https://example.com/alice.jpg')
  })

  it('updateProfile rejects invalid email', async () => {
    const routes = registerStoreRoutes(config, holder)
    const result = await routes.handleMutation('s1', 'updateProfile', {
      displayName: 'Alice',
      email: 'not-an-email',
      avatar: 'https://example.com/a.jpg'
    })
    expect(result.isErr()).toBe(true)
  })

  it('updateProfile rejects invalid URL', async () => {
    const routes = registerStoreRoutes(config, holder)
    const result = await routes.handleMutation('s1', 'updateProfile', {
      displayName: 'Alice',
      email: 'alice@example.com',
      avatar: 'not a url'
    })
    expect(result.isErr()).toBe(true)
  })

  it('toggleDarkMode flips boolean field', async () => {
    const routes = registerStoreRoutes(config, holder)
    expect(routes.getState('s1').darkMode).toBe(false)

    await routes.handleMutation('s1', 'toggleDarkMode', {})
    expect(routes.getState('s1').darkMode).toBe(true)

    await routes.handleMutation('s1', 'toggleDarkMode', {})
    expect(routes.getState('s1').darkMode).toBe(false)
  })

  it('setNotifications updates multiselect array', async () => {
    const routes = registerStoreRoutes(config, holder)
    await routes.handleMutation('s1', 'setNotifications', { channels: ['email', 'push'] })
    expect(routes.getState('s1').notifications).toEqual(['email', 'push'])
  })

  it('setNotifications rejects invalid option', async () => {
    const routes = registerStoreRoutes(config, holder)
    const result = await routes.handleMutation('s1', 'setNotifications', { channels: ['email', 'pigeon'] })
    expect(result.isErr()).toBe(true)
  })

  it('setLayout updates custom field with complex object', async () => {
    const routes = registerStoreRoutes(config, holder)
    await routes.handleMutation('s1', 'setLayout', {
      layout: { sidebar: 'hidden', density: 'compact' }
    })
    expect(routes.getState('s1').layout).toEqual({ sidebar: 'hidden', density: 'compact' })
  })

  it('setLayout rejects invalid layout values', async () => {
    const routes = registerStoreRoutes(config, holder)
    const result = await routes.handleMutation('s1', 'setLayout', {
      layout: { sidebar: 'top', density: 'huge' }
    })
    expect(result.isErr()).toBe(true)
  })

  it('preserves unmodified fields across mutations', async () => {
    const routes = registerStoreRoutes(config, holder)
    await routes.handleMutation('s1', 'updateProfile', {
      displayName: 'Bob',
      email: 'bob@example.com',
      avatar: 'https://example.com/bob.jpg'
    })
    await routes.handleMutation('s1', 'toggleDarkMode', {})

    const state = routes.getState('s1')
    expect(state.displayName).toBe('Bob')
    expect(state.darkMode).toBe(true)
    expect(state.accentColor).toBe('#3b82f6')
    expect(state.language).toBe('en')
  })
})
