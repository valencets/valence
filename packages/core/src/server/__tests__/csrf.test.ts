import { describe, it, expect } from 'vitest'
import { generateCsrfToken, validateCsrfToken } from '../csrf.js'

describe('generateCsrfToken', () => {
  it('returns a 64-char hex string', () => {
    const token = generateCsrfToken()
    expect(token).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns different values on each call', () => {
    const a = generateCsrfToken()
    const b = generateCsrfToken()
    expect(a).not.toBe(b)
  })
})

describe('validateCsrfToken', () => {
  it('returns true for matching tokens', () => {
    const token = generateCsrfToken()
    expect(validateCsrfToken(token, token)).toBe(true)
  })

  it('returns false for mismatched tokens', () => {
    const a = generateCsrfToken()
    const b = generateCsrfToken()
    expect(validateCsrfToken(a, b)).toBe(false)
  })

  it('returns false for empty tokens', () => {
    expect(validateCsrfToken('', '')).toBe(false)
  })
})
