import { describe, it, expect } from 'vitest'
import { handleMutation } from '../server/mutation-handler.js'
import { SessionStateHolder } from '../server/session-state.js'
import { field } from '../fields/index.js'
import { store } from '../index.js'
import { StoreErrorCode } from '../types.js'
import type { StoreDefinition } from '../types.js'

function makeCounterStore (): StoreDefinition {
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
        server: async ({ state }) => {
          state.count = 0
        }
      }
    }
  })
  if (result.isErr()) {
    return undefined as never
  }
  return result.value
}

const mockSession = { id: 'test-session' }
const mockPool = { query: async () => [] }

describe('handleMutation', () => {
  it('executes valid mutation and returns updated state', async () => {
    const config = makeCounterStore()
    const holder = SessionStateHolder.create(config.fields)

    const result = await handleMutation(config, holder, mockSession.id, 'increment', { amount: 5 }, mockPool, mockSession)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.state.count).toBe(5)
      expect(result.value.confirmedId).toBeDefined()
    }
  })

  it('persists state after mutation', async () => {
    const config = makeCounterStore()
    const holder = SessionStateHolder.create(config.fields)

    await handleMutation(config, holder, mockSession.id, 'increment', { amount: 3 }, mockPool, mockSession)
    await handleMutation(config, holder, mockSession.id, 'increment', { amount: 7 }, mockPool, mockSession)

    const state = holder.getState(mockSession.id)
    expect(state.count).toBe(10)
  })

  it('rejects unknown mutation name', async () => {
    const config = makeCounterStore()
    const holder = SessionStateHolder.create(config.fields)

    const result = await handleMutation(config, holder, mockSession.id, 'nonexistent', {}, mockPool, mockSession)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.INVALID_MUTATION)
    }
  })

  it('rejects invalid input against Zod schema', async () => {
    const config = makeCounterStore()
    const holder = SessionStateHolder.create(config.fields)

    const result = await handleMutation(config, holder, mockSession.id, 'increment', { amount: 'not a number' }, mockPool, mockSession)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.VALIDATION_FAILED)
    }
  })

  it('does not modify state on validation failure', async () => {
    const config = makeCounterStore()
    const holder = SessionStateHolder.create(config.fields)

    await handleMutation(config, holder, mockSession.id, 'increment', { amount: 5 }, mockPool, mockSession)
    await handleMutation(config, holder, mockSession.id, 'increment', { amount: 'bad' }, mockPool, mockSession)

    const state = holder.getState(mockSession.id)
    expect(state.count).toBe(5)
  })

  it('mutation with empty input array succeeds', async () => {
    const config = makeCounterStore()
    const holder = SessionStateHolder.create(config.fields)

    await handleMutation(config, holder, mockSession.id, 'increment', { amount: 10 }, mockPool, mockSession)
    const result = await handleMutation(config, holder, mockSession.id, 'reset', {}, mockPool, mockSession)
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.state.count).toBe(0)
    }
  })

  it('returns error if server function throws', async () => {
    const throwingResult = store({
      slug: 'boom',
      scope: 'session',
      fields: [field.text({ name: 'x' })],
      mutations: {
        explode: {
          input: [],
          server: async () => {
            const e = new Error('kaboom')
            return Promise.reject(e)
          }
        }
      }
    })
    if (throwingResult.isErr()) return
    const config = throwingResult.value
    const holder = SessionStateHolder.create(config.fields)

    const result = await handleMutation(config, holder, mockSession.id, 'explode', {}, mockPool, mockSession)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(StoreErrorCode.MUTATION_FAILED)
    }
  })

  it('does not modify state if server function rejects', async () => {
    const throwingResult = store({
      slug: 'boom2',
      scope: 'session',
      fields: [field.number({ name: 'val', default: 42 })],
      mutations: {
        fail: {
          input: [],
          server: async ({ state }) => {
            state.val = 999
            return Promise.reject(new Error('rollback'))
          }
        }
      }
    })
    if (throwingResult.isErr()) return
    const config = throwingResult.value
    const holder = SessionStateHolder.create(config.fields)

    await handleMutation(config, holder, mockSession.id, 'fail', {}, mockPool, mockSession)
    const state = holder.getState(mockSession.id)
    expect(state.val).toBe(42)
  })
})
