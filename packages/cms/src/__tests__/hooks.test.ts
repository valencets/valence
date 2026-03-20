import { describe, it, expect } from 'vitest'
import { runHooks } from '../hooks/hook-runner.js'
import type { CollectionHooks, HookArgs } from '../hooks/hook-types.js'
import type { TextFieldConfig } from '../schema/field-types.js'

describe('CollectionHooks', () => {
  it('accepts all lifecycle hook arrays', () => {
    const hooks: CollectionHooks = {
      beforeValidate: [({ data }) => ({ ...data, validated: true })],
      beforeChange: [],
      afterChange: [],
      beforeRead: [],
      afterRead: [],
      beforeDelete: [],
      afterDelete: []
    }
    expect(hooks.beforeValidate).toHaveLength(1)
    expect(hooks.beforeChange).toHaveLength(0)
  })

  it('allows partial hook definitions', () => {
    const hooks: CollectionHooks = {
      afterChange: [() => undefined]
    }
    expect(hooks.afterChange).toHaveLength(1)
    expect(hooks.beforeChange).toBeUndefined()
  })
})

describe('FieldHooks on FieldBaseConfig', () => {
  it('field config accepts hooks with all lifecycle events', () => {
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'title',
      hooks: {
        beforeValidate: [({ data }) => ({ ...data, validated: true })],
        beforeChange: [({ data }) => data],
        afterChange: [({ data }) => data],
        afterRead: [({ data }) => data]
      }
    }
    expect(fieldConfig.hooks).toBeDefined()
    expect(fieldConfig.hooks?.beforeValidate).toHaveLength(1)
    expect(fieldConfig.hooks?.beforeChange).toHaveLength(1)
    expect(fieldConfig.hooks?.afterChange).toHaveLength(1)
    expect(fieldConfig.hooks?.afterRead).toHaveLength(1)
  })

  it('field config works without hooks (backward compat)', () => {
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'title'
    }
    expect(fieldConfig.hooks).toBeUndefined()
  })

  it('field config accepts partial hooks', () => {
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'title',
      hooks: {
        afterRead: [({ data }) => ({ ...data, transformed: true })]
      }
    }
    expect(fieldConfig.hooks?.afterRead).toHaveLength(1)
    expect(fieldConfig.hooks?.beforeChange).toBeUndefined()
  })
})

describe('runHooks()', () => {
  it('executes hooks sequentially and returns final data', async () => {
    const calls: number[] = []
    const hooks = [
      (args: HookArgs) => { calls.push(1); return args.data },
      (args: HookArgs) => { calls.push(2); return args.data }
    ]
    const result = await runHooks(hooks, { data: { title: 'Test' } })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual([1, 2])
  })

  it('passes transformed data through the chain', async () => {
    const hooks = [
      (args: HookArgs) => ({ ...args.data, step1: true }),
      (args: HookArgs) => ({ ...args.data, step2: true })
    ]
    const result = await runHooks(hooks, { data: { title: 'Test' } })
    expect(result.isOk()).toBe(true)
    const final = result._unsafeUnwrap()
    expect(final).toEqual({ title: 'Test', step1: true, step2: true })
  })

  it('returns Err when a hook throws', async () => {
    const hooks = [
      () => { throw new Error('hook failed') }
    ]
    const result = await runHooks(hooks, { data: { title: 'Test' } })
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().message).toContain('hook failed')
  })

  it('returns Ok with original data when hooks array is empty', async () => {
    const result = await runHooks([], { data: { title: 'Test' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ title: 'Test' })
  })

  it('handles hooks that return undefined (fire-and-forget)', async () => {
    const sideEffect: string[] = []
    const hooks = [
      (args: HookArgs) => { sideEffect.push('logged'); return args.data },
      () => undefined
    ]
    const result = await runHooks(hooks, { data: { title: 'Test' } })
    expect(result.isOk()).toBe(true)
    expect(sideEffect).toEqual(['logged'])
    // data passes through unchanged when hook returns undefined
    expect(result._unsafeUnwrap()).toEqual({ title: 'Test' })
  })

  it('handles async hooks', async () => {
    const hooks = [
      async (args: HookArgs) => {
        await Promise.resolve()
        return { ...args.data, async: true }
      }
    ]
    const result = await runHooks(hooks, { data: { title: 'Test' } })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual({ title: 'Test', async: true })
  })
})
