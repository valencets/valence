import { describe, it, expect, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'
import { registerStoreRoutes } from '../server/store-routes.js'
import { SessionStateHolder } from '../server/session-state.js'
import { SSEBroadcaster } from '../server/sse-broadcaster.js'
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

describe('SSE + Mutation integration', () => {
  let config: StoreDefinition
  let holder: SessionStateHolder
  let broadcaster: SSEBroadcaster

  beforeEach(() => {
    config = makeCounterConfig()
    holder = SessionStateHolder.create(config.fields)
    broadcaster = SSEBroadcaster.create()
  })

  it('mutation broadcasts state to connected SSE client', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const sseRes = mockSSERes()
    broadcaster.addClient('counter', 'observer', sseRes as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 5 })

    expect(sseRes._written).toHaveLength(1)
    expect(sseRes._written[0]).toContain('event: state')
    expect(sseRes._written[0]).toContain('"count":5')
  })

  it('mutation broadcasts to all clients except the mutator', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const mutatorRes = mockSSERes()
    const observerRes = mockSSERes()
    broadcaster.addClient('counter', 'mutator', mutatorRes as ServerResponse)
    broadcaster.addClient('counter', 'observer', observerRes as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 3 })

    // Mutator gets confirmation, not broadcast
    expect(mutatorRes._written).toHaveLength(0)
    // Observer gets state broadcast
    expect(observerRes._written).toHaveLength(1)
    expect(observerRes._written[0]).toContain('"count":3')
  })

  it('failed mutation does not broadcast', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const sseRes = mockSSERes()
    broadcaster.addClient('counter', 'observer', sseRes as ServerResponse)

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

  it('multiple mutations accumulate and broadcast latest state', async () => {
    const routes = registerStoreRoutes(config, holder, broadcaster)
    const sseRes = mockSSERes()
    broadcaster.addClient('counter', 'observer', sseRes as ServerResponse)

    await routes.handleMutation('mutator', 'increment', { amount: 1 })
    await routes.handleMutation('mutator', 'increment', { amount: 2 })
    await routes.handleMutation('mutator', 'increment', { amount: 3 })

    expect(sseRes._written).toHaveLength(3)
    expect(sseRes._written[2]).toContain('"count":6')
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
