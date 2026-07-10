import { describe, it, expect } from 'vitest'
import { validateProductionSecret, MIN_SECRET_LENGTH, SecretErrorCode } from '../secret-guard.js'
import { generateSecret } from '../config-template.js'

// #339 — production must never run with a missing, default, or trivially
// weak CMS_SECRET: it signs anonymous store sessions (HMAC) and underpins
// session security.

describe('validateProductionSecret', () => {
  it('rejects a missing secret', () => {
    const result = validateProductionSecret(undefined)
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(SecretErrorCode.MISSING)
      expect(result.error.message).toContain('CMS_SECRET')
    }
  })

  it('rejects an empty secret', () => {
    const result = validateProductionSecret('')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(SecretErrorCode.MISSING)
    }
  })

  it('rejects the dev fallback "dev-secret"', () => {
    const result = validateProductionSecret('dev-secret')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(SecretErrorCode.KNOWN_DEFAULT)
      expect(result.error.message).toContain('CMS_SECRET')
    }
  })

  it('rejects the .env.example placeholder "change-me"', () => {
    const result = validateProductionSecret('change-me')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(SecretErrorCode.KNOWN_DEFAULT)
    }
  })

  it(`rejects secrets shorter than ${MIN_SECRET_LENGTH} characters`, () => {
    const result = validateProductionSecret('a'.repeat(MIN_SECRET_LENGTH - 1))
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe(SecretErrorCode.TOO_SHORT)
      expect(result.error.message).toContain(String(MIN_SECRET_LENGTH))
    }
  })

  it(`accepts a secret of exactly ${MIN_SECRET_LENGTH} characters`, () => {
    const result = validateProductionSecret('x'.repeat(MIN_SECRET_LENGTH))
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value).toBe('x'.repeat(MIN_SECRET_LENGTH))
    }
  })
})

describe('generateSecret', () => {
  it('mints secrets that pass the production guard', () => {
    const result = validateProductionSecret(generateSecret())
    expect(result.isOk()).toBe(true)
  })

  it('emits 64 lowercase hex characters (32 bytes of CSPRNG output)', () => {
    const secret = generateSecret()
    expect(secret).toMatch(/^[0-9a-f]{64}$/)
  })

  it('emits a different secret on every call', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 16; i++) {
      seen.add(generateSecret())
    }
    expect(seen.size).toBe(16)
  })
})
