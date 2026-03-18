import { describe, it, expect } from 'vitest'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'

describe('CmsErrorCode', () => {
  it('exposes all expected error codes', () => {
    expect(CmsErrorCode.NOT_FOUND).toBe('NOT_FOUND')
    expect(CmsErrorCode.INVALID_INPUT).toBe('INVALID_INPUT')
    expect(CmsErrorCode.VALIDATION_FAILED).toBe('VALIDATION_FAILED')
    expect(CmsErrorCode.DUPLICATE_SLUG).toBe('DUPLICATE_SLUG')
    expect(CmsErrorCode.UNAUTHORIZED).toBe('UNAUTHORIZED')
    expect(CmsErrorCode.FORBIDDEN).toBe('FORBIDDEN')
    expect(CmsErrorCode.INTERNAL).toBe('INTERNAL')
  })

  it('is frozen (no runtime mutation)', () => {
    expect(Object.isFrozen(CmsErrorCode)).toBe(true)
  })

  it('has exactly 7 codes', () => {
    expect(Object.keys(CmsErrorCode)).toHaveLength(7)
  })
})

describe('CmsError', () => {
  it('satisfies the interface with code and message', () => {
    const error: CmsError = {
      code: CmsErrorCode.NOT_FOUND,
      message: 'Document not found'
    }
    expect(error.code).toBe('NOT_FOUND')
    expect(error.message).toBe('Document not found')
  })

  it('accepts every error code variant', () => {
    const codes = Object.values(CmsErrorCode)
    for (const code of codes) {
      const error: CmsError = { code, message: `test ${code}` }
      expect(error.code).toBe(code)
    }
  })
})
