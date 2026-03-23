import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../auth/password.js'

describe('hashPassword()', () => {
  it('returns Ok with an argon2 hash string', async () => {
    const result = await hashPassword('test-password-123')
    expect(result.isOk()).toBe(true)
    const hash = result.unwrap()
    expect(hash).toMatch(/^\$argon2/)
  })

  it('produces different hashes for the same input (salted)', async () => {
    const r1 = await hashPassword('same-password')
    const r2 = await hashPassword('same-password')
    expect(r1.unwrap()).not.toBe(r2.unwrap())
  })
})

describe('verifyPassword()', () => {
  it('returns Ok(true) for correct password', async () => {
    const hash = (await hashPassword('my-secret')).unwrapOr('')
    const result = await verifyPassword('my-secret', hash)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(true)
  })

  it('returns Ok(false) for wrong password', async () => {
    const hash = (await hashPassword('my-secret')).unwrapOr('')
    const result = await verifyPassword('wrong-password', hash)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toBe(false)
  })

  it('returns Err for invalid hash string', async () => {
    const result = await verifyPassword('password', 'not-a-hash')
    expect(result.isErr()).toBe(true)
  })
})
