import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'
import { registerStoreRoutes } from '../server/store-routes.js'
import { SessionStateHolder } from '../server/session-state.js'
import { PostgresStateHolder } from '../server/pg-state-holder.js'
import { SSEBroadcaster } from '../server/sse-broadcaster.js'
import { handleMutation } from '../server/mutation-handler.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import type { StoreDefinition, StoreState, StoreScope } from '../types.js'

const mockPool = { query: async () => [] }

function makeCounterConfig (scope: StoreScope = 'user'): StoreDefinition {
  const result = store({
    slug: 'prefs',
    scope,
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

describe('SessionInfo threading through store routes', () => {
  it('user-scoped state follows the userId across different sessions', async () => {
    const config = makeCounterConfig('user')
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    await routes.handleMutation({ id: 'laptop-session', userId: 'user-1' }, 'increment', { amount: 3 })
    const phoneView = await routes.getState({ id: 'phone-session', userId: 'user-1' })

    expect(phoneView.count).toBe(3)
  })

  it('user-scoped state is isolated between different userIds', async () => {
    const config = makeCounterConfig('user')
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    await routes.handleMutation({ id: 's1', userId: 'user-a' }, 'increment', { amount: 5 })
    const other = await routes.getState({ id: 's2', userId: 'user-b' })

    expect(other.count).toBe(0)
  })

  it('session-scoped state still keys by session id', async () => {
    const config = makeCounterConfig('session')
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder)

    await routes.handleMutation({ id: 'sess-1', userId: 'user-1' }, 'increment', { amount: 2 })
    const sameUserOtherSession = await routes.getState({ id: 'sess-2', userId: 'user-1' })

    expect(sameUserOtherSession.count).toBe(0)
  })

  it('the mutation server fn receives the userId on its session context', async () => {
    let seenUserId: string | undefined
    const result = store({
      slug: 'whoami',
      scope: 'user',
      fields: [field.text({ name: 'noop' })],
      mutations: {
        record: {
          input: [],
          server: async ({ session }) => {
            seenUserId = session.userId
          }
        }
      }
    })
    if (result.isErr()) return
    const holder = SessionStateHolder.create(result.value.fields)
    const routes = registerStoreRoutes(result.value, holder)

    await routes.handleMutation({ id: 'sess-9', userId: 'user-42' }, 'record', {})
    expect(seenUserId).toBe('user-42')
  })
})

describe('async state backends', () => {
  it('handleMutation awaits Promise-returning getState/setState backends', async () => {
    const config = makeCounterConfig('user')
    const stored = new Map<string, StoreState>()
    const asyncHolder = {
      async getState (key: string): Promise<StoreState> {
        return { ...(stored.get(key) ?? { count: 0 }) }
      },
      async setState (key: string, state: StoreState): Promise<void> {
        stored.set(key, { ...state })
      }
    }

    const result = await handleMutation(config, asyncHolder, 'bucket-1', 'increment', { amount: 4 }, mockPool, { id: 'sess', userId: 'u1' })

    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.state.count).toBe(4)
    }
    expect(stored.get('bucket-1')?.count).toBe(4)
  })
})

describe('PostgresStateHolder', () => {
  const fields = [field.number({ name: 'count', default: 7 }), field.text({ name: 'theme' })]

  it('returns field defaults when no row exists', async () => {
    const query = vi.fn(async () => [])
    const holder = PostgresStateHolder.create({ pool: { query }, slug: 'prefs', fields })

    const state = await holder.getState('user:u1')

    expect(state.count).toBe(7)
    expect(state.theme).toBeUndefined()
    const [sql, ...params] = query.mock.calls[0]! as unknown as [string, ...string[]]
    expect(sql).toContain('store_states')
    expect(sql).toContain('$1')
    expect(params).toEqual(['prefs', 'user:u1'])
  })

  it('returns the stored jsonb state when a row exists', async () => {
    const query = vi.fn(async () => [{ state: { count: 12, theme: 'dark' } }])
    const holder = PostgresStateHolder.create({ pool: { query }, slug: 'prefs', fields })

    const state = await holder.getState('user:u1')

    expect(state.count).toBe(12)
    expect(state.theme).toBe('dark')
  })

  it('setState upserts with parameterized slug, key, and serialized state', async () => {
    const query = vi.fn(async () => [])
    const holder = PostgresStateHolder.create({ pool: { query }, slug: 'prefs', fields })

    await holder.setState('user:u1', { count: 3, theme: 'light' })

    const [sql, ...params] = query.mock.calls[0]! as unknown as [string, ...string[]]
    expect(sql).toContain('INSERT INTO')
    expect(sql).toContain('ON CONFLICT')
    expect(sql).not.toContain('user:u1')
    expect(params[0]).toBe('prefs')
    expect(params[1]).toBe('user:u1')
    expect(JSON.parse(params[2]!)).toEqual({ count: 3, theme: 'light' })
  })

  it('round-trips through registerStoreRoutes for a user-scoped store', async () => {
    const rows = new Map<string, StoreState>()
    const query = vi.fn(async (sql: string, ...params: string[]) => {
      if (sql.startsWith('INSERT')) {
        rows.set(`${params[0]}|${params[1]}`, JSON.parse(params[2]!) as StoreState)
        return []
      }
      const row = rows.get(`${params[0]}|${params[1]}`)
      return row ? [{ state: row }] : []
    })
    const config = makeCounterConfig('user')
    const holder = PostgresStateHolder.create({ pool: { query }, slug: config.slug, fields: config.fields })
    const routes = registerStoreRoutes(config, holder)

    await routes.handleMutation({ id: 'sess-1', userId: 'u9' }, 'increment', { amount: 6 })
    const fromOtherDevice = await routes.getState({ id: 'sess-2', userId: 'u9' })

    expect(fromOtherDevice.count).toBe(6)
  })
})

describe('user-scope SSE audience', () => {
  let broadcaster: SSEBroadcaster

  beforeEach(() => {
    broadcaster = SSEBroadcaster.create()
  })

  it('sendToUser reaches every connection of that user across sessions', () => {
    const laptop = mockSSERes()
    const phone = mockSSERes()
    const stranger = mockSSERes()
    broadcaster.addClient('prefs', 'sess-laptop', laptop as ServerResponse, 'user-1')
    broadcaster.addClient('prefs', 'sess-phone', phone as ServerResponse, 'user-1')
    broadcaster.addClient('prefs', 'sess-x', stranger as ServerResponse, 'user-2')

    broadcaster.sendToUser('prefs', 'user-1', 'state', { count: 1 })

    expect(laptop._written).toHaveLength(1)
    expect(phone._written).toHaveLength(1)
    expect(stranger._written).toHaveLength(0)
  })

  it('a user-scoped mutation broadcasts to all of the user sessions and nobody else', async () => {
    const config = makeCounterConfig('user')
    const holder = SessionStateHolder.create(config.fields)
    const routes = registerStoreRoutes(config, holder, broadcaster)

    const otherDevice = mockSSERes()
    const otherUser = mockSSERes()
    broadcaster.addClient('prefs', 'sess-phone', otherDevice as ServerResponse, 'user-1')
    broadcaster.addClient('prefs', 'sess-x', otherUser as ServerResponse, 'user-2')

    await routes.handleMutation({ id: 'sess-laptop', userId: 'user-1' }, 'increment', { amount: 2 })

    expect(otherDevice._written).toHaveLength(1)
    expect(otherDevice._written[0]).toContain('"count":2')
    expect(otherUser._written).toHaveLength(0)
  })
})
