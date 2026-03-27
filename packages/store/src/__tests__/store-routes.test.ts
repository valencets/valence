import { describe, it, expect } from 'vitest'
import { registerStoreRoutes } from '../server/store-routes.js'
import { SessionStateHolder } from '../server/session-state.js'
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
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

describe('registerStoreRoutes', () => {
  it('returns a route map with mutation and state endpoints', () => {
    const config = makeCounterConfig()
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    expect(routes).toBeDefined()
    expect(routes.mutationPath).toBe('/store/counter/:mutation')
    expect(routes.statePath).toBe('/store/counter/state')
  })

  it('handleMutation processes valid POST and returns state', async () => {
    const config = makeCounterConfig()
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    const result = await routes.handleMutation('test-session', 'increment', { amount: 5 })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.state.count).toBe(5)
    }
  })

  it('handleMutation rejects unknown mutation', async () => {
    const config = makeCounterConfig()
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    const result = await routes.handleMutation('test-session', 'unknown', {})
    expect(result.isErr()).toBe(true)
  })

  it('getState returns current state for session', () => {
    const config = makeCounterConfig()
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    const state = routes.getState('test-session')
    expect(state.count).toBe(0)
  })

  it('getState reflects mutations', async () => {
    const config = makeCounterConfig()
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    await routes.handleMutation('test-session', 'increment', { amount: 3 })
    await routes.handleMutation('test-session', 'increment', { amount: 7 })
    const state = routes.getState('test-session')
    expect(state.count).toBe(10)
  })
})
