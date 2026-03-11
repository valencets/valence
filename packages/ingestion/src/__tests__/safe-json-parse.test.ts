import { describe, it, expect } from 'vitest'
import { safeJsonParse } from '../safe-json-parse.js'

describe('safeJsonParse', () => {
  describe('Ok — valid JSON', () => {
    it('parses a valid object', () => {
      const result = safeJsonParse('{"a":1}')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ a: 1 })
    })

    it('parses a valid array', () => {
      const result = safeJsonParse('[1,2,3]')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual([1, 2, 3])
    })

    it('parses a string literal', () => {
      const result = safeJsonParse('"hello"')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe('hello')
    })

    it('parses null', () => {
      const result = safeJsonParse('null')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBeNull()
    })

    it('parses a number', () => {
      const result = safeJsonParse('42')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toBe(42)
    })

    it('parses deeply nested objects', () => {
      const nested = '{"a":{"b":{"c":{"d":1}}}}'
      const result = safeJsonParse(nested)
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ a: { b: { c: { d: 1 } } } })
    })

    it('parses unicode content', () => {
      const result = safeJsonParse('{"emoji":"\\u2603"}')
      expect(result.isOk()).toBe(true)
      expect(result._unsafeUnwrap()).toEqual({ emoji: '\u2603' })
    })

    it('parses a large payload', () => {
      const items = Array.from({ length: 1024 }, (_, i) => ({ id: i }))
      const raw = JSON.stringify(items)
      const result = safeJsonParse(raw)
      expect(result.isOk()).toBe(true)
      const parsed = result._unsafeUnwrap() as Array<{ id: number }>
      expect(parsed).toHaveLength(1024)
    })
  })

  describe('Err — malformed JSON', () => {
    it('rejects an empty string', () => {
      const result = safeJsonParse('')
      expect(result.isErr()).toBe(true)
    })

    it('rejects malformed JSON (missing brace)', () => {
      const result = safeJsonParse('{"a":1')
      expect(result.isErr()).toBe(true)
    })

    it('rejects plain text', () => {
      const result = safeJsonParse('not json at all')
      expect(result.isErr()).toBe(true)
    })

    it('rejects the string "undefined"', () => {
      const result = safeJsonParse('undefined')
      expect(result.isErr()).toBe(true)
    })

    it('rejects truncated input', () => {
      const result = safeJsonParse('[1,2,')
      expect(result.isErr()).toBe(true)
    })

    it('rejects trailing commas', () => {
      const result = safeJsonParse('{"a":1,}')
      expect(result.isErr()).toBe(true)
    })

    it('rejects single quotes', () => {
      const result = safeJsonParse("{'a':1}")
      expect(result.isErr()).toBe(true)
    })
  })

  describe('contract — error shape', () => {
    it('error has code PARSE_FAILURE', () => {
      const result = safeJsonParse('bad')
      expect(result.isErr()).toBe(true)
      expect(result._unsafeUnwrapErr().code).toBe('PARSE_FAILURE')
    })

    it('error raw field matches original input', () => {
      const input = '{broken'
      const result = safeJsonParse(input)
      expect(result._unsafeUnwrapErr().raw).toBe(input)
    })

    it('error message is non-empty', () => {
      const result = safeJsonParse('')
      expect(result._unsafeUnwrapErr().message.length).toBeGreaterThan(0)
    })
  })

  describe('safety — never throws', () => {
    it('does not throw for any input', () => {
      const inputs = ['', 'null', 'undefined', '{', '}', '[]', '"', '123', 'true', 'NaN']
      for (const input of inputs) {
        expect(() => safeJsonParse(input)).not.toThrow()
      }
    })
  })
})
