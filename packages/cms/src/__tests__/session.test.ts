import { describe, it, expect, vi } from 'vitest'
import { createSession, validateSession, destroySession } from '../auth/session.js'
import type { DbPool } from '@valencets/db'

function makeMockPool (returnValue: readonly Record<string, string | number | null>[] = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

function makeErrorPool (error: Error): DbPool {
  const sql = vi.fn(() => Promise.reject(error)) as unknown as DbPool['sql']
  return { sql }
}

describe('createSession()', () => {
  it('returns Ok with session id', async () => {
    const pool = makeMockPool([{ id: 'session-abc', user_id: 'user-1' }])
    const result = await createSession('user-1', pool)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('session-abc')
    expect(pool.sql).toHaveBeenCalled()
  })

  it('returns Err on db failure', async () => {
    const pool = makeErrorPool(new Error('db down'))
    const result = await createSession('user-1', pool)
    expect(result.isErr()).toBe(true)
  })
})

describe('validateSession()', () => {
  it('returns Ok with user id for valid session', async () => {
    const pool = makeMockPool([{ id: 'session-abc', user_id: 'user-1', expires_at: '2099-01-01T00:00:00Z' }])
    const result = await validateSession('session-abc', pool)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('user-1')
  })

  it('returns Err NOT_FOUND for expired/missing session', async () => {
    const pool = makeMockPool([])
    const result = await validateSession('nonexistent', pool)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND')
  })
})

describe('destroySession()', () => {
  it('returns Ok on success', async () => {
    const pool = makeMockPool([{ id: 'session-abc' }])
    const result = await destroySession('session-abc', pool)
    expect(result.isOk()).toBe(true)
  })

  it('returns Err on db failure', async () => {
    const pool = makeErrorPool(new Error('db down'))
    const result = await destroySession('session-abc', pool)
    expect(result.isErr()).toBe(true)
  })
})
