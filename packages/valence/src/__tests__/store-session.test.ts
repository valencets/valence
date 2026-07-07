import { describe, it, expect } from 'vitest'
import { mintSignedSessionId, verifySignedSessionId, buildStoreSessionCookie } from '../store-session.js'

const SECRET = 'unit-test-secret'

describe('signed store sessions', () => {
  it('mint produces id.signature and verify round-trips to the id', () => {
    const token = mintSignedSessionId(SECRET)
    const parts = token.split('.')
    expect(parts).toHaveLength(2)
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/)

    const verified = verifySignedSessionId(SECRET, token)
    expect(verified).toBe(parts[0])
  })

  it('mints unique ids per call', () => {
    expect(mintSignedSessionId(SECRET)).not.toBe(mintSignedSessionId(SECRET))
  })

  it('rejects a tampered id', () => {
    const token = mintSignedSessionId(SECRET)
    const [id, sig] = token.split('.') as [string, string]
    const flipped = (id[0] === 'a' ? 'b' : 'a') + id.slice(1)
    expect(verifySignedSessionId(SECRET, `${flipped}.${sig}`)).toBeNull()
  })

  it('rejects a token signed with a different secret', () => {
    const token = mintSignedSessionId('other-secret')
    expect(verifySignedSessionId(SECRET, token)).toBeNull()
  })

  it('rejects malformed tokens without throwing', () => {
    expect(verifySignedSessionId(SECRET, 'no-dot-here')).toBeNull()
    expect(verifySignedSessionId(SECRET, '.')).toBeNull()
    expect(verifySignedSessionId(SECRET, 'abc.short')).toBeNull()
    expect(verifySignedSessionId(SECRET, '')).toBeNull()
  })

  it('builds an HttpOnly SameSite cookie', () => {
    const cookie = buildStoreSessionCookie('abc.def')
    expect(cookie).toContain('session_id=abc.def')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Path=/')
  })
})

describe('cookie security flags', () => {
  it('marks the session cookie Secure on encrypted connections', async () => {
    const { buildStoreSessionCookie } = await import('../store-session.js')
    const cookie = buildStoreSessionCookie('abc.def', true)
    expect(cookie).toContain('; Secure')
    expect(cookie).toContain('HttpOnly')
  })

  it('omits Secure over plain http so local development keeps working', async () => {
    const { buildStoreSessionCookie } = await import('../store-session.js')
    const cookie = buildStoreSessionCookie('abc.def', false)
    expect(cookie).not.toContain('Secure')
  })
})
