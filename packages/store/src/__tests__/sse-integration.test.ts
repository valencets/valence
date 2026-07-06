import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'
import { registerStoreRoutes } from '../server/store-routes.js'
import { SessionStateHolder } from '../server/session-state.js'
import { SSEBroadcaster } from '../server/sse-broadcaster.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import type { StoreDefinition, StoreScope } from '../types.js'

function makeCounterConfig (scope: StoreScope = 'session'): StoreDefinition {
  const result = store({
    slug: 'counter',
    scope,
    fields: [field.number({ name: 'count', default: 0 })],
    mutations: {
      increment: {
        input: [field.number({ name: 'amount' })],
        server: async ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        }
      },
      bump: {
        input: [],
        server: async ({ state }) => {
          state.count = (state.count as number) + 1
        }
      }
    }
  })
  if (result.isErr()) return undefined as never
  return result.value
}

function mockSSERes (): ServerResponse & { _written: string[]; _headers: { [key: string]: string } } {
  const emitter = new EventEmitter()
  const res = Object.assign(emitter, {
    _written: [] as string[],
    _headers: {} as { [key: string]: string },
    setHeader (name: string, value: string) { res._headers[name] = value },
    flushHeaders () {},
    write (chunk: string) { res._written.push(chunk); return true },
    end () {}
  })
  return res as ServerResponse & { _written: string[]; _headers: { [key: string]: string } }
}

describe('SSE + Mutation integration — session scope', () => {
  let config: StoreDefinition
  let holder: SessionStateHolder
  let broadcaster: SSEBroadcaster

  beforeEach(() => {
    config = makeCounterConfig('session')
    holder = SessionStateHolder.create(config.fields)
    broadcaster = SSEBroadcaster.create()
  })

  it("session-scoped mutation reaches the mutating session's other tabs", async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const tab1 = mockSSERes()
    const tab2 = mockSSERes()
    broadcaster.addClient('counter', 'mutator', tab1 as ServerResponse)
    broadcaster.addClient('counter', 'mutator', tab2 as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 5 })

    expect(tab1._written).toHaveLength(1)
    expect(tab1._written[0]).toContain('event: state')
    expect(tab1._written[0]).toContain('"count":5')
    expect(tab2._written).toHaveLength(1)
    expect(tab2._written[0]).toContain('"count":5')
  })

  it('session-scoped mutation is NOT sent to other sessions', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const observerRes = mockSSERes()
    broadcaster.addClient('counter', 'observer', observerRes as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 3 })

    expect(observerRes._written).toHaveLength(0)
  })

  it('failed mutation does not broadcast', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const sseRes = mockSSERes()
    broadcaster.addClient('counter', 'mutator', sseRes as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 'bad' })

    expect(sseRes._written).toHaveLength(0)
  })

  it('mutation result includes confirmed state for the mutator', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)

    const result = await routes.handleMutation('s1', 'increment', { amount: 7 })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.state.count).toBe(7)
      expect(result.value.confirmedId).toBeDefined()
    }
  })

  it('multiple mutations accumulate and broadcast latest state to the session', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const secondTab = mockSSERes()
    broadcaster.addClient('counter', 'mutator', secondTab as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 1 })
    await routes.handleMutation('mutator', 'increment', { amount: 2 })
    await routes.handleMutation('mutator', 'increment', { amount: 3 })

    expect(secondTab._written).toHaveLength(3)
    expect(secondTab._written[2]).toContain('"count":6')
  })

  it('works without broadcaster (backwards compatible)', async () => {
    const routes = registerStoreRoutes(config, holder)
    const result = await routes.handleMutation('s1', 'increment', { amount: 10 })
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.state.count).toBe(10)
    }
  })
})

describe('SSE + Mutation integration — global scope', () => {
  let config: StoreDefinition
  let holder: SessionStateHolder
  let broadcaster: SSEBroadcaster

  beforeEach(() => {
    config = makeCounterConfig('global')
    holder = SessionStateHolder.create(config.fields)
    broadcaster = SSEBroadcaster.create()
  })

  it('global-scoped mutation broadcasts to every connected session', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const observerRes = mockSSERes()
    broadcaster.addClient('counter', 'observer', observerRes as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 4 })

    expect(observerRes._written).toHaveLength(1)
    expect(observerRes._written[0]).toContain('"count":4')
  })

  it('global-scoped state is one shared copy across sessions', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)

    await routes.handleMutation('session-a', 'increment', { amount: 5 })

    expect(routes.getState('session-b').count).toBe(5)
  })

  it('concurrent global mutations from different sessions all land', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)

    const promises = Array.from({ length: 10 }, (_, i) =>
      routes.handleMutation(`session-${i}`, 'bump', {})
    )
    await Promise.all(promises)

    expect(routes.getState('any-session').count).toBe(10)
  })
})

describe('SSE + Mutation integration — page scope', () => {
  it('page-scoped mutation does not broadcast', async () => {
    const config = makeCounterConfig('page')
    const holder = SessionStateHolder.create(config.fields)
    const broadcaster = SSEBroadcaster.create()
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const sseRes = mockSSERes()
    broadcaster.addClient('counter', 'mutator', sseRes as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 1 })

    expect(sseRes._written).toHaveLength(0)
  })
})
