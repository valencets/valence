import { describe, it, expect } from 'vitest'
import { makeSequentialMockPool, makeErrorPool, makeMockPool } from './test-helpers.js'
import { createServerEventLogger } from '../server-events.js'

const mockSession = {
  session_id: 'sess-001',
  created_at: new Date(),
  referrer: 'server',
  device_type: 'server',
  operating_system: ''
}

const mockEvent = {
  event_id: 1,
  session_id: 'sess-001',
  created_at: new Date(),
  event_category: 'USER_REGISTER',
  dom_target: 'api.register',
  payload: {}
}

describe('createServerEventLogger', () => {
  it('returns a logger with a log method', () => {
    const pool = makeMockPool([])
    const logger = createServerEventLogger(pool)
    expect(typeof logger.log).toBe('function')
  })

  it('logs an event successfully', async () => {
    const pool = makeSequentialMockPool({
      session: [mockSession],
      event: [mockEvent]
    })
    const logger = createServerEventLogger(pool)
    const result = await logger.log('USER_REGISTER', 'api.register', { userId: '123' })
    expect(result.isOk()).toBe(true)
    const row = result._unsafeUnwrap()
    expect(row.event_category).toBe('USER_REGISTER')
    expect(row.session_id).toBe('sess-001')
  })

  it('propagates session creation error', async () => {
    const pool = makeErrorPool(new Error('db down'))
    const logger = createServerEventLogger(pool)
    const result = await logger.log('CLICK', 'button')
    expect(result.isErr()).toBe(true)
  })

  it('propagates event insertion error', async () => {
    // Session succeeds on first call, event fails on second call
    let callCount = 0
    const sql = Object.assign(
      () => {
        callCount++
        if (callCount === 1) return Promise.resolve([mockSession])
        return Promise.reject(new Error('insert failed'))
      },
      { json: (v: unknown) => v }
    ) as any
    const pool = { sql } as any

    const logger = createServerEventLogger(pool)
    const result = await logger.log('FAIL_TEST', 'target')
    expect(result.isErr()).toBe(true)
  })

  it('defaults payload to empty object', async () => {
    const pool = makeSequentialMockPool({
      session: [mockSession],
      event: [{ ...mockEvent, event_category: 'TEST', dom_target: 'test' }]
    })
    const logger = createServerEventLogger(pool)
    const result = await logger.log('TEST', 'test')
    expect(result.isOk()).toBe(true)
  })
})
