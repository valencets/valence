import { describe, it, expect } from 'vitest'
import { createSession, validateSession, destroySession, buildSessionCookie, buildExpiredSessionCookie } from '../auth/session.js'
import { makeMockPool, makeErrorPool } from './test-helpers.js'

describe('createSession()', () => {
  it('returns Ok with session id', async () => {
    const pool = makeMockPool([{ id: 'session-abc', user_id: 'user-1' }])
    const result = await createSession('user-1', pool)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('session-abc')
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
    const result = await validateSession('session-abc', pool)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe('user-1')
  })

  it('queries cms_sessions table with session id', async () => {
    const pool = makeMockPool([{ id: 's1', user_id: 'u1', expires_at: '2099-01-01' }])
    await validateSession('s1', pool)
    const call = (pool.sql.unsafe as ReturnType<typeof import('vitest').vi.fn>).mock.calls[0]
    expect(call?.[0]).toContain('cms_sessions')
    expect(call?.[0]).toContain('expires_at > NOW()')
    expect(call?.[0]).toContain('deleted_at IS NULL')
    expect(call?.[1]).toContain('s1')
  })

  it('returns Err NOT_FOUND for expired/missing session', async () => {
    const pool = makeMockPool([])
    const result = await validateSession('nonexistent', pool)
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('NOT_FOUND')
  })

  it('returns Err NOT_FOUND message includes session context', async () => {
    const pool = makeMockPool([])
    const result = await validateSession('bad-id', pool)
    const err = result._unsafeUnwrapErr()
    expect(err.message).toContain('Session')
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
