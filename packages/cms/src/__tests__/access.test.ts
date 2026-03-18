import { describe, it, expect } from 'vitest'
import { resolveAccess } from '../access/access-resolver.js'
import type { AccessControlFunction, CollectionAccess, FieldAccess } from '../access/access-types.js'
import type { WhereClause } from '../db/query-types.js'

describe('AccessControlFunction', () => {
  it('accepts a function that returns boolean', () => {
    const fn: AccessControlFunction = () => true
    expect(fn({})).toBe(true)
  })

  it('accepts a function that returns a WhereClause', () => {
    const fn: AccessControlFunction = () => ({
      and: [{ field: 'owner', operator: 'equals' as const, value: 'user-123' }]
    })
    const result = fn({})
    expect(typeof result).toBe('object')
  })
})

describe('CollectionAccess', () => {
  it('accepts per-operation access functions', () => {
    const access: CollectionAccess = {
      create: () => true,
      read: () => ({ and: [{ field: 'published', operator: 'equals' as const, value: true }] }),
      update: () => false,
      delete: () => false
    }
    expect(access.create?.({})).toBe(true)
    expect(access.update?.({})).toBe(false)
  })
})

describe('FieldAccess', () => {
  it('accepts per-operation field access', () => {
    const access: FieldAccess = {
      create: () => true,
      read: () => true,
      update: () => false
    }
    expect(access.create?.({})).toBe(true)
    expect(access.update?.({})).toBe(false)
  })
})

describe('resolveAccess()', () => {
  it('returns Ok(true) when access returns true', async () => {
    const fn: AccessControlFunction = () => true
    const result = await resolveAccess(fn, {})
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(true)
  })

  it('returns Ok(false) when access returns false', async () => {
    const fn: AccessControlFunction = () => false
    const result = await resolveAccess(fn, {})
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(false)
  })

  it('returns Ok(WhereClause) when access returns a where clause', async () => {
    const where: WhereClause = {
      and: [{ field: 'owner', operator: 'equals', value: 'user-1' }]
    }
    const fn: AccessControlFunction = () => where
    const result = await resolveAccess(fn, {})
    expect(result.isOk()).toBe(true)
    const resolved = result._unsafeUnwrap()
    expect(typeof resolved).toBe('object')
    expect((resolved as WhereClause).and).toHaveLength(1)
  })

  it('returns Err when access function throws', async () => {
    const fn: AccessControlFunction = () => { throw new Error('access error') }
    const result = await resolveAccess(fn, {})
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('access error')
  })

  it('returns Ok(true) when no access function provided', async () => {
    const result = await resolveAccess(undefined, {})
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBe(true)
  })
})
