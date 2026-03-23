import { describe, it, expect } from 'vitest'
import { createSession, validateSession, destroySession, buildSessionCookie, buildExpiredSessionCookie } from '../auth/session.js'
import { makeMockPool, makeErrorPool } from './test-helpers.js'

describe('createSession()', () => {
  it('returns Ok with session id', async () => {
    const pool = makeMockPool([{ id: 'session-abc', user_id: 'user-1' }])
    const result = await createSession('user-1', pool)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe('session-abc')
    expect(pool.sql.unsafe).toHaveBeenCalled()
  })

  it('passes user id as SQL parameter', async () => {
    const pool = makeMockPool([{ id: 'session-xyz', user_id: 'user-42' }])
    await createSession('user-42', pool)
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('cms_sessions')
    expect(call?.[0]).toContain('INSERT')
    expect(call?.[1]).toContain('user-42')
  })

  it('returns Err when no session row returned', async () => {
    const pool = makeMockPool([])
    const result = await createSession('user-1', pool)
    expect(result.isErr()).toBe(true)
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
    const result = await validateSession('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', pool)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe('user-1')
  })

  it('queries cms_sessions table with session id', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01' }])
    await validateSession('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4', pool)
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('cms_sessions')
    expect(call?.[0]).toContain('expires_at > NOW()')
    expect(call?.[0]).toContain('deleted_at IS NULL')
    expect(call?.[1]).toContain('a0a0a0a0-b1b1-c2c2-d3d3-e4e4e4e4e4e4')
  })

  it('returns Err NOT_FOUND for expired/missing session', async () => {
    const pool = makeMockPool([])
    const result = await validateSession('00000000-0000-0000-0000-000000000000', pool)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('NOT_FOUND')
  })

  it('returns Err NOT_FOUND message includes session context', async () => {
    const pool = makeMockPool([])
    const result = await validateSession('00000000-0000-0000-0000-000000000001', pool)
    const err = result.unwrapErr()
    expect(err.message).toContain('Session')
  })

  it('rejects non-UUID session IDs without querying DB (AUTH-01)', async () => {
    const pool = makeMockPool([])
    const result = await validateSession('not-a-uuid', pool)
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().code).toBe('NOT_FOUND')
    expect(result.unwrapErr().message).toContain('Invalid session ID format')
    expect(pool.sql.unsafe).not.toHaveBeenCalled()
  })

  it('rejects SQL injection attempts in session ID (AUTH-01)', async () => {
    const pool = makeMockPool([])
    const result = await validateSession("'; DROP TABLE cms_sessions; --", pool)
    expect(result.isErr()).toBe(true)
    expect(pool.sql.unsafe).not.toHaveBeenCalled()
  })

  it('accepts uppercase UUID format (AUTH-01)', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01' }])
    const result = await validateSession('A0A0A0A0-B1B1-C2C2-D3D3-E4E4E4E4E4E4', pool)
    expect(result.isOk()).toBe(true)
  })
})

describe('destroySession()', () => {
  it('returns Ok on success', async () => {
    const pool = makeMockPool([{ id: 'session-abc' }])
    const result = await destroySession('session-abc', pool)
    expect(result.isOk()).toBe(true)
  })

  it('soft-deletes by setting deleted_at', async () => {
    const pool = makeMockPool([{ id: 'session-abc' }])
    await destroySession('session-abc', pool)
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('deleted_at')
    expect(call?.[0]).toContain('UPDATE')
    expect(call?.[1]).toContain('session-abc')
  })

  it('returns Err on db failure', async () => {
    const pool = makeErrorPool(new Error('db down'))
    const result = await destroySession('session-abc', pool)
    expect(result.isErr()).toBe(true)
  })
})

describe('buildSessionCookie()', () => {
  it('includes session id in cookie value', () => {
    const cookie = buildSessionCookie('sess-123')
    expect(cookie).toContain('cms_session=sess-123')
  })

  it('includes HttpOnly and Secure flags by default', () => {
    const cookie = buildSessionCookie('sess-123')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('Secure')
  })

  it('omits Secure flag when secure is false', () => {
    const cookie = buildSessionCookie('sess-123', 7200, false)
    expect(cookie).toContain('HttpOnly')
    expect(cookie).not.toContain('Secure')
  })

  it('includes SameSite=Lax', () => {
    const cookie = buildSessionCookie('sess-123')
    expect(cookie).toContain('SameSite=Lax')
  })

  it('uses custom max age when provided', () => {
    const cookie = buildSessionCookie('sess-123', 3600)
    expect(cookie).toContain('Max-Age=3600')
  })

  it('defaults to 7200 max age', () => {
    const cookie = buildSessionCookie('sess-123')
    expect(cookie).toContain('Max-Age=7200')
  })
})

describe('buildExpiredSessionCookie()', () => {
  it('sets Max-Age=0 to expire the cookie', () => {
    const cookie = buildExpiredSessionCookie()
    expect(cookie).toContain('Max-Age=0')
  })

  it('sets empty session value', () => {
    const cookie = buildExpiredSessionCookie()
    expect(cookie).toContain('cms_session=')
  })

  it('includes Secure flag by default', () => {
    const cookie = buildExpiredSessionCookie()
    expect(cookie).toContain('Secure')
  })

  it('omits Secure flag when secure is false', () => {
    const cookie = buildExpiredSessionCookie(false)
    expect(cookie).not.toContain('Secure')
  })
})
