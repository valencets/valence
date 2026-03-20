import { describe, it, expect } from 'vitest'
import {
  generateToken,
  hashToken,
  verifyToken,
  createCustomSession,
  validateCustomSession,
  destroyCustomSession,
  TokenErrorCode,
  SessionErrorCode
} from '../index.js'

describe('auth barrel exports', () => {
  it('exports generateToken as a function', () => {
    expect(typeof generateToken).toBe('function')
  })

  it('exports hashToken as a function', () => {
    expect(typeof hashToken).toBe('function')
  })

  it('exports verifyToken as a function', () => {
    expect(typeof verifyToken).toBe('function')
  })

  it('exports createCustomSession as a function', () => {
    expect(typeof createCustomSession).toBe('function')
  })

  it('exports validateCustomSession as a function', () => {
    expect(typeof validateCustomSession).toBe('function')
  })

  it('exports destroyCustomSession as a function', () => {
    expect(typeof destroyCustomSession).toBe('function')
  })

  it('exports TokenErrorCode with expected keys', () => {
    expect(TokenErrorCode.GENERATION_FAILED).toBe('GENERATION_FAILED')
    expect(TokenErrorCode.HASH_FAILED).toBe('HASH_FAILED')
  })

  it('exports SessionErrorCode with expected keys', () => {
    expect(SessionErrorCode.INTERNAL).toBe('INTERNAL')
    expect(SessionErrorCode.SESSION_NOT_FOUND).toBe('SESSION_NOT_FOUND')
    expect(SessionErrorCode.SESSION_EXPIRED).toBe('SESSION_EXPIRED')
  })
})
