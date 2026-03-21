import { describe, it, expect } from 'vitest'
import { generateCsrfToken, validateCsrfToken } from '../auth/csrf.js'

describe('generateCsrfToken()', () => {
  it('returns a 64-char hex string', () => {
    const token = generateCsrfToken()
    expect(token).toHaveLength(64)
    expect(token).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces unique tokens', () => {
    const t1 = generateCsrfToken()
    const t2 = generateCsrfToken()
    expect(t1).not.toBe(t2)
  })
})

describe('validateCsrfToken()', () => {
  it('returns true for matching tokens', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, token)).toBe(true)
  })

  it('returns false for different tokens', () => {
    const t1 = generateCsrfToken()
    const t2 = generateCsrfToken()
    expect(validateCsrfToken(t1, t2)).toBe(false)
  })

  it('returns false for different lengths', () => {
    expect(validateCsrfToken('short', 'longer-token')).toBe(false)
  })

  it('returns false when token is empty string', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken('', token)).toBe(false)
  })
})
