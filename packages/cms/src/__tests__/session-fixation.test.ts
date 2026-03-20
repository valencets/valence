import { describe, it, expect } from 'vitest'
import { destroyUserSessions } from '../auth/session.js'
import { makeMockPool } from './test-helpers.js'

describe('destroyUserSessions', () => {
  it('soft-deletes all sessions for a user and returns Ok', async () => {
    const pool = makeMockPool([])
    const result = await destroyUserSessions('user-1', pool)
    expect(result.isOk()).toBe(true)
    expect(pool.sql.unsafe).toHaveBeenCalledWith(
      expect.stringContaining('deleted_at = NOW()'),
      ['user-1']
    )
  })

  it('returns Ok even when no sessions exist', async () => {
    const pool = makeMockPool([])
    const result = await destroyUserSessions('user-no-sessions', pool)
    expect(result.isOk()).toBe(true)
  })
})
