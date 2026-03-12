import { describe, it, expect } from 'vitest'
import { auditFile, BANNED_PATTERNS } from '../banned-patterns.js'

describe('BANNED_PATTERNS', () => {
  it('exports an array of pattern rules', () => {
    expect(Array.isArray(BANNED_PATTERNS)).toBe(true)
    expect(BANNED_PATTERNS.length).toBeGreaterThan(0)
  })

  it('each rule has id, pattern, message, and scope', () => {
    for (const rule of BANNED_PATTERNS) {
      expect(rule.id).toBeDefined()
      expect(rule.pattern).toBeInstanceOf(RegExp)
      expect(rule.message).toBeDefined()
      expect(rule.scope).toBeDefined()
    }
  })
})

describe('auditFile', () => {
  it('detects throw new Error in business logic', () => {
    const violations = auditFile(
      'packages/db/src/queries.ts',
      'function foo() {\n  throw new Error("bad")\n}'
    )
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]?.ruleId).toBe('no-throw')
  })

  it('allows throw in test files', () => {
    const violations = auditFile(
      'packages/db/src/__tests__/setup.ts',
      'function setup() {\n  throw new Error("setup")\n}'
    )
    const throwViolations = violations.filter((v) => v.ruleId === 'no-throw')
    expect(throwViolations.length).toBe(0)
  })

  it('detects try/catch', () => {
    const violations = auditFile(
      'packages/core/src/router.ts',
      'try {\n  doStuff()\n} catch (e) {\n  handle(e)\n}'
    )
    expect(violations.some((v) => v.ruleId === 'no-try-catch')).toBe(true)
  })

  it('detects switch statements', () => {
    const violations = auditFile(
      'packages/core/src/util.ts',
      'switch (x) {\n  case 1: break\n}'
    )
    expect(violations.some((v) => v.ruleId === 'no-switch')).toBe(true)
  })

  it('detects enum keyword', () => {
    const violations = auditFile(
      'packages/db/src/types.ts',
      'export enum Status {\n  Active,\n  Inactive\n}'
    )
    expect(violations.some((v) => v.ruleId === 'no-enum')).toBe(true)
  })

  it('detects .parse() on Zod schemas', () => {
    const violations = auditFile(
      'sites/studio/features/audit/schemas/schema.ts',
      'const result = schema.parse(data)'
    )
    expect(violations.some((v) => v.ruleId === 'no-zod-parse')).toBe(true)
  })

  it('allows .safeParse() on Zod schemas', () => {
    const violations = auditFile(
      'sites/studio/features/audit/schemas/schema.ts',
      'const result = schema.safeParse(data)'
    )
    const parseViolations = violations.filter((v) => v.ruleId === 'no-zod-parse')
    expect(parseViolations.length).toBe(0)
  })

  it('detects empty criticalCSS in handler code', () => {
    const violations = auditFile(
      'sites/studio/features/home/server/handler.ts',
      "const opts = { criticalCSS: '' }"
    )
    expect(violations.some((v) => v.ruleId === 'no-empty-critical-css')).toBe(true)
  })

  it('detects import React in public code', () => {
    const violations = auditFile(
      'sites/studio/features/home/components/Home.ts',
      "import React from 'react'"
    )
    expect(violations.some((v) => v.ruleId === 'no-react-public')).toBe(true)
  })

  it('ignores non-business files', () => {
    const violations = auditFile(
      'node_modules/foo/bar.ts',
      'throw new Error("ok in deps")'
    )
    expect(violations.length).toBe(0)
  })

  it('detects default export', () => {
    const violations = auditFile(
      'packages/core/src/util.ts',
      'export default function foo() {}'
    )
    expect(violations.some((v) => v.ruleId === 'no-default-export')).toBe(true)
  })
})
