import { describe, it, expect } from 'vitest'
import { generateToken, hashToken, verifyToken, TokenErrorCode } from '../auth/token-utils.js'

describe('generateToken()', () => {
  it('returns Ok with a hex string of default length (64 chars for 32 bytes)', () => {
    const result = generateToken()
    expect(result.isOk()).toBe(true)
    const token = result._unsafeUnwrap()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('returns Ok with a hex string of specified byte length', () => {
    const result = generateToken(16)
    expect(result.isOk()).toBe(true)
    const token = result._unsafeUnwrap()
    // 16 bytes = 32 hex chars
    expect(token).toHaveLength(32)
    expect(token).toMatch(/^[a-f0-9]{32}$/)
  })

  it('produces unique tokens each call', () => {
    const t1 = generateToken()._unsafeUnwrap()
    const t2 = generateToken()._unsafeUnwrap()
    expect(t1).not.toBe(t2)
  })
})

describe('hashToken()', () => {
  it('returns Ok with a SHA-256 hex string (64 chars)', () => {
    const result = hashToken('some-token-value')
    expect(result.isOk()).toBe(true)
    const hash = result._unsafeUnwrap()
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces different hashes for different tokens', () => {
    const h1 = hashToken('token-a')._unsafeUnwrap()
    const h2 = hashToken('token-b')._unsafeUnwrap()
    expect(h1).not.toBe(h2)
  })

  it('produces identical hashes for the same token (deterministic)', () => {
    const h1 = hashToken('same-token')._unsafeUnwrap()
    const h2 = hashToken('same-token')._unsafeUnwrap()
    expect(h1).toBe(h2)
  })
})

describe('verifyToken()', () => {
  it('returns Ok(true) when token matches its hash', () => {
    const token = generateToken()._unsafeUnwrap()
    const hash = hashToken(token)._unsafeUnwrap()
    const result = verifyToken(token, hash)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(true)
  })

  it('returns Ok(false) when token does not match hash', () => {
    const token = generateToken()._unsafeUnwrap()
    const wrongToken = generateToken()._unsafeUnwrap()
    const hash = hashToken(token)._unsafeUnwrap()
    const result = verifyToken(wrongToken, hash)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(false)
  })

  it('returns Ok(false) when hash length does not match SHA-256 output', () => {
    const token = generateToken()._unsafeUnwrap()
    const result = verifyToken(token, 'short-hash')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(false)
  })
})

describe('TokenErrorCode', () => {
  it('exports GENERATION_FAILED and HASH_FAILED codes', () => {
    expect(TokenErrorCode.GENERATION_FAILED).toBe('GENERATION_FAILED')
    expect(TokenErrorCode.HASH_FAILED).toBe('HASH_FAILED')
  })
})
