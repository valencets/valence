import { describe, it, expect } from 'vitest'
import {
  createCustomSession,
  validateCustomSession,
  destroyCustomSession,
  SessionErrorCode
} from '../auth/custom-session.js'
import { makeMockPool, makeErrorPool } from './test-helpers.js'

const TABLE = 'user_sessions'

describe('createCustomSession()', () => {
  it('returns Ok with sessionId and expiresAt on success', async () => {
    const expiresAt = '2099-01-01T00:00:00.000Z'
    const pool = makeMockPool([{ id: 'sess-abc123', user_id: 'user-1', expires_at: expiresAt }])
    const result = await createCustomSession(pool, TABLE, 'user-1')
    expect(result.isOk()).toBe(true)
    const val = result.unwrap()
    expect(val.sessionId).toBe('sess-abc123')
    expect(val.expiresAt).toBeInstanceOf(Date)
  })

  it('inserts into the provided table name', async () => {
    const pool = makeMockPool([{ id: 'sess-xyz', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await createCustomSession(pool, 'my_custom_sessions', 'u1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('my_custom_sessions')
    expect(call?.[0]).toContain('INSERT')
  })

  it('passes userId as a SQL parameter', async () => {
    const pool = makeMockPool([{ id: 'sess-1', user_id: 'user-42', expires_at: '2099-01-01T00:00:00.000Z' }])
    await createCustomSession(pool, TABLE, 'user-42')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[1]).toContain('user-42')
  })

  it('generates unique session IDs across multiple calls', async () => {
    const makePool = () => makeMockPool([{ id: 'sess-placeholder', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    // Since the ID is generated client-side and passed to the DB, we verify it is part of the parameters
    const pool1 = makePool()
    const pool2 = makePool()
    await createCustomSession(pool1, TABLE, 'u1')
    await createCustomSession(pool2, TABLE, 'u1')
    const call1 = (pool1.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    const call2 = (pool2.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    // Each call should pass a distinct session ID as a param
    const id1 = call1?.[1]?.[0]
    const id2 = call2?.[1]?.[0]
    expect(id1).not.toBe(id2)
  })

  it('uses custom maxAge when provided', async () => {
    const pool = makeMockPool([{ id: 'sess-1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await createCustomSession(pool, TABLE, 'u1', 3600)
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[1]).toContain(3600)
  })

  it('returns Err INTERNAL when db returns no rows', async () => {
    const pool = makeMockPool([])
    const result = await createCustomSession(pool, TABLE, 'u1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
  })

  it('returns Err INTERNAL on db failure', async () => {
    const pool = makeErrorPool(new Error('db down'))
    const result = await createCustomSession(pool, TABLE, 'u1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
  })

  it('returns Err INTERNAL when tableName contains SQL injection', async () => {
    const pool = makeMockPool([{ id: 'sess-1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    const result = await createCustomSession(pool, "'; DROP TABLE users; --", 'u1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
    expect(result.unwrapErr().message).toBe('Invalid table name')
    // Must not have called the database at all
    expect((pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls).toHaveLength(0)
  })

  it('uses sanitized (double-quoted) table name in SQL', async () => {
    const pool = makeMockPool([{ id: 'sess-1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await createCustomSession(pool, TABLE, 'u1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('"user_sessions"')
  })

  it('returns Err INTERNAL when tableName contains SQL injection', async () => {
    const pool = makeMockPool([{ id: 'sess-1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    const result = await createCustomSession(pool, "'; DROP TABLE users; --", 'u1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
    expect(result.unwrapErr().message).toBe('Invalid table name')
    // Must not have called the database at all
    expect((pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls).toHaveLength(0)
  })

  it('uses sanitized (double-quoted) table name in SQL', async () => {
    const pool = makeMockPool([{ id: 'sess-1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await createCustomSession(pool, TABLE, 'u1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('"user_sessions"')
  })
})

describe('validateCustomSession()', () => {
  it('returns Ok with userId for a valid non-expired session', async () => {
    const pool = makeMockPool([{ id: 'sess-abc', user_id: 'user-7', expires_at: '2099-01-01T00:00:00.000Z' }])
    const result = await validateCustomSession(pool, TABLE, 'sess-abc')
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().userId).toBe('user-7')
  })

  it('queries the provided table name', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await validateCustomSession(pool, 'custom_sessions_tbl', 's1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('custom_sessions_tbl')
  })

  it('passes sessionId as a SQL parameter', async () => {
    const pool = makeMockPool([{ id: 'my-sess', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await validateCustomSession(pool, TABLE, 'my-sess')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[1]).toContain('my-sess')
  })

  it('checks expiry in the SQL query', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await validateCustomSession(pool, TABLE, 's1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('expires_at')
    expect(call?.[0]).toContain('NOW()')
  })

  it('returns Err SESSION_NOT_FOUND when session is missing or expired', async () => {
    const pool = makeMockPool([])
    const result = await validateCustomSession(pool, TABLE, 'nonexistent')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.SESSION_NOT_FOUND)
  })

  it('returns Err SESSION_EXPIRED with appropriate message for empty result', async () => {
    const pool = makeMockPool([])
    const result = await validateCustomSession(pool, TABLE, 'expired-id')
    const err = result.unwrapErr()
    expect(err.message).toMatch(/session/i)
  })

  it('returns Err INTERNAL on db failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await validateCustomSession(pool, TABLE, 's1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
  })

  it('returns Err INTERNAL when tableName contains SQL injection', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    const result = await validateCustomSession(pool, "'; DROP TABLE users; --", 's1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
    expect(result.unwrapErr().message).toBe('Invalid table name')
    expect((pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls).toHaveLength(0)
  })

  it('uses sanitized (double-quoted) table name in SQL', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await validateCustomSession(pool, TABLE, 's1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('"user_sessions"')
  })

  it('returns Err INTERNAL when tableName contains SQL injection', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    const result = await validateCustomSession(pool, "'; DROP TABLE users; --", 's1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
    expect(result.unwrapErr().message).toBe('Invalid table name')
    expect((pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls).toHaveLength(0)
  })

  it('uses sanitized (double-quoted) table name in SQL', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01T00:00:00.000Z' }])
    await validateCustomSession(pool, TABLE, 's1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('"user_sessions"')
  })
})

describe('destroyCustomSession()', () => {
  it('returns Ok(void) on success', async () => {
    const pool = makeMockPool([{ id: 'sess-abc' }])
    const result = await destroyCustomSession(pool, TABLE, 'sess-abc')
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBeUndefined()
  })

  it('deletes from the provided table name', async () => {
    const pool = makeMockPool([])
    await destroyCustomSession(pool, 'my_sessions', 'sess-1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('my_sessions')
    expect(call?.[0]).toMatch(/DELETE|deleted_at/)
  })

  it('passes sessionId as a SQL parameter', async () => {
    const pool = makeMockPool([])
    await destroyCustomSession(pool, TABLE, 'my-session-id')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[1]).toContain('my-session-id')
  })

  it('returns Err INTERNAL on db failure', async () => {
    const pool = makeErrorPool(new Error('disk full'))
    const result = await destroyCustomSession(pool, TABLE, 'sess-1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
  })

  it('returns Err INTERNAL when tableName contains SQL injection', async () => {
    const pool = makeMockPool([])
    const result = await destroyCustomSession(pool, "'; DROP TABLE users; --", 'sess-1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
    expect(result.unwrapErr().message).toBe('Invalid table name')
    expect((pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls).toHaveLength(0)
  })

  it('uses sanitized (double-quoted) table name in SQL', async () => {
    const pool = makeMockPool([])
    await destroyCustomSession(pool, TABLE, 'sess-1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('"user_sessions"')
  })

  it('returns Err INTERNAL when tableName contains SQL injection', async () => {
    const pool = makeMockPool([])
    const result = await destroyCustomSession(pool, "'; DROP TABLE users; --", 'sess-1')
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe(SessionErrorCode.INTERNAL)
    expect(result.unwrapErr().message).toBe('Invalid table name')
    expect((pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls).toHaveLength(0)
  })

  it('uses sanitized (double-quoted) table name in SQL', async () => {
    const pool = makeMockPool([])
    await destroyCustomSession(pool, TABLE, 'sess-1')
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('"user_sessions"')
  })
})

describe('SessionErrorCode', () => {
  it('exports INTERNAL, SESSION_NOT_FOUND, SESSION_EXPIRED codes', () => {
    expect(SessionErrorCode.INTERNAL).toBe('INTERNAL')
    expect(SessionErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND')
    expect(SessionErrorCode.SESSION_EXPIRED).toBe('SESSION_EXPIRED')
  })
})
