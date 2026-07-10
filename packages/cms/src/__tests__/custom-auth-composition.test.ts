import { describe, it, expect, vi } from 'vitest'
import type { DbPool } from '@valencets/db'
// #338 — every primitive must be reachable from the PUBLIC entry point:
// this file imports the barrel, not the modules.
import {
  hashPassword,
  verifyPassword,
  createCustomSession,
  validateCustomSession,
  destroyCustomSession,
  generateToken,
  hashToken,
  verifyToken,
  createRateLimiter
} from '../index.js'

// The dogfood app hand-built PBKDF2 + SHA-256 tokens + localStorage
// sessions because these primitives weren't documented as a public
// toolkit. This suite proves the advertised composition: signup → login →
// session check → logout, entirely on the public surface, Result-based.

/** A stateful mock pool: one users row store + one app_sessions row store. */
function appPool () {
  const users = new Map<string, { id: string, password_hash: string }>()
  const sessions = new Map<string, { id: string, user_id: string, expires_at: string }>()

  const unsafe = vi.fn(async (text: string, params: readonly string[] = []) => {
    if (text.includes('INSERT INTO "app_users"')) {
      users.set(String(params[0]), { id: 'user-1', password_hash: String(params[1]) })
      return [{ id: 'user-1' }]
    }
    if (text.includes('FROM "app_users"')) {
      const row = users.get(String(params[0]))
      return row ? [row] : []
    }
    if (text.includes('INSERT INTO "app_sessions"')) {
      const row = { id: String(params[0]), user_id: String(params[1]), expires_at: new Date(Date.now() + 7200_000).toISOString() }
      sessions.set(row.id, row)
      return [row]
    }
    // DELETE first — its text also contains the SELECT branch's needle
    if (text.includes('DELETE') && text.includes('app_sessions')) {
      sessions.delete(String(params[0]))
      return []
    }
    if (text.includes('FROM "app_sessions"')) {
      const row = sessions.get(String(params[0]))
      return row ? [row] : []
    }
    return []
  })

  const sql = Object.assign(vi.fn(), { unsafe, begin: vi.fn() })
  return { pool: { sql } as unknown as DbPool, users, sessions }
}

describe('custom auth composition (public surface)', () => {
  it('signup → login → session check → logout, all Results, no plaintext at rest', async () => {
    const { pool, sessions } = appPool()

    // Signup: hash and store — never the plaintext
    const hash = await hashPassword('correct horse battery staple')
    expect(hash.isOk()).toBe(true)
    await pool.sql.unsafe('INSERT INTO "app_users" ("email", "password_hash") VALUES ($1, $2)', ['a@b.c', hash.isOk() ? hash.value : ''])

    // Login: verify against the stored hash
    const rows = await pool.sql.unsafe('SELECT * FROM "app_users" WHERE email = $1', ['a@b.c'])
    const stored = (rows[0] as { password_hash: string }).password_hash
    expect(stored.startsWith('$argon2id$')).toBe(true)
    expect((await verifyPassword('correct horse battery staple', stored)).isOk() &&
      (await verifyPassword('correct horse battery staple', stored)).unwrapOr(false)).toBe(true)
    expect((await verifyPassword('wrong password', stored)).unwrapOr(true)).toBe(false)

    // Session mint into the app's own table
    const minted = await createCustomSession(pool, 'app_sessions', 'user-1')
    expect(minted.isOk()).toBe(true)
    const sessionId = minted.isOk() ? minted.value.sessionId : ''
    expect(sessionId).toMatch(/^[0-9a-f]{64}$/)

    // Session check — the shape loaders/actions consume
    const valid = await validateCustomSession(pool, 'app_sessions', sessionId)
    expect(valid.isOk()).toBe(true)
    if (valid.isOk()) expect(valid.value.userId).toBe('user-1')

    // Logout
    const destroyed = await destroyCustomSession(pool, 'app_sessions', sessionId)
    expect(destroyed.isOk()).toBe(true)
    expect(sessions.has(sessionId)).toBe(false)
  })

  it('rejects forged and unknown session tokens', async () => {
    const { pool } = appPool()
    const result = await validateCustomSession(pool, 'app_sessions', 'f'.repeat(64))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) expect(result.error.code).toBe('SESSION_NOT_FOUND')
  })

  it('token mint → hash-at-rest → timing-safe verify roundtrip', () => {
    const token = generateToken()
    expect(token.isOk()).toBe(true)
    const raw = token.isOk() ? token.value : ''

    const digest = hashToken(raw)
    expect(digest.isOk()).toBe(true)
    const stored = digest.isOk() ? digest.value : ''
    expect(stored).not.toBe(raw)

    expect(verifyToken(raw, stored).unwrapOr(false)).toBe(true)
    // Deterministic tamper: flip the first hex nibble
    const tampered = (raw[0] === '0' ? '1' : '0') + raw.slice(1)
    expect(verifyToken(tampered, stored).unwrapOr(true)).toBe(false)
  })

  it('rate limiter guards a login route: allows, blocks, resets', () => {
    const limiter = createRateLimiter({ maxAttempts: 3, windowMs: 60_000 })

    expect(limiter.check('ip:1.2.3.4')).toBe(true)
    expect(limiter.check('ip:1.2.3.4')).toBe(true)
    expect(limiter.check('ip:1.2.3.4')).toBe(true)
    expect(limiter.check('ip:1.2.3.4')).toBe(false)
    expect(limiter.remaining('ip:1.2.3.4')).toBe(0)

    limiter.reset('ip:1.2.3.4')
    expect(limiter.check('ip:1.2.3.4')).toBe(true)
  })
})
