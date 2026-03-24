import { describe, it, expect } from 'vitest'
import { runFieldHooks } from '../hooks/field-hook-runner.js'
import type { FieldConfig } from '../schema/field-types.js'
import type { HookArgs } from '../hooks/hook-types.js'

describe('runFieldHooks()', () => {
  it('field hook transforms the data', async () => {
    const fields: readonly FieldConfig[] = [
      {
        type: 'text',
        name: 'title',
        hooks: {
          beforeChange: [({ data }: HookArgs) => ({ ...data, title: 'transformed' })]
        }
      }
    ]
    const result = await runFieldHooks('beforeChange', fields, { title: 'original' })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual({ title: 'transformed' })
  })

  it('multiple field hooks run in sequence', async () => {
    const calls: string[] = []
    const fields: readonly FieldConfig[] = [
      {
        type: 'text',
        name: 'title',
        hooks: {
          beforeChange: [({ data }: HookArgs) => { calls.push('title'); return { ...data, title: 'changed' } }]
        }
      },
      {
        type: 'text',
        name: 'slug',
        hooks: {
          beforeChange: [({ data }: HookArgs) => { calls.push('slug'); return { ...data, slug: 'changed' } }]
        }
      }
    ]
    const result = await runFieldHooks('beforeChange', fields, { title: 'a', slug: 'b' })
    expect(result.isOk()).toBe(true)
    expect(calls).toEqual(['title', 'slug'])
    expect(result.unwrap()).toEqual({ title: 'changed', slug: 'changed' })
  })

  it('fields without hooks pass through unchanged', async () => {
    const fields: readonly FieldConfig[] = [
      { type: 'text', name: 'title' },
      { type: 'number', name: 'count' }
    ]
    const data = { title: 'hello', count: 5 }
    const result = await runFieldHooks('beforeChange', fields, data)
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual(data)
  })

  it('hook receives the correct data including id and collection', async () => {
    let captured: HookArgs | undefined
    const fields: readonly FieldConfig[] = [
      {
        type: 'text',
        name: 'title',
        hooks: {
          afterRead: [(args: HookArgs) => { captured = args; return args.data }]
        }
      }
    ]
    await runFieldHooks('afterRead', fields, { title: 'test' }, 'doc-123', 'posts')
    expect(captured).toBeDefined()
    expect(captured?.data).toEqual({ title: 'test' })
    expect(captured?.id).toBe('doc-123')
    expect(captured?.collection).toBe('posts')
  })

  it('async hooks work correctly', async () => {
    const fields: readonly FieldConfig[] = [
      {
        type: 'text',
        name: 'title',
        hooks: {
          afterChange: [async ({ data }: HookArgs) => {
            await Promise.resolve()
            return { ...data, title: 'async-result' }
          }]
        }
      }
    ]
    const result = await runFieldHooks('afterChange', fields, { title: 'before' })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual({ title: 'async-result' })
  })

  it('returns Err when a field hook throws', async () => {
    const fields: readonly FieldConfig[] = [
      {
        type: 'text',
        name: 'title',
        hooks: {
          beforeValidate: [() => { throw new Error('validation failed') }]
        }
      }
    ]
    const result = await runFieldHooks('beforeValidate', fields, { title: 'test' })
    expect(result.isErr()).toBe(true)
    expect(result.unwrapErr().message).toContain('validation failed')
  })

  it('only runs hooks for the specified hookName', async () => {
    const calls: string[] = []
    const fields: readonly FieldConfig[] = [
      {
        type: 'text',
        name: 'title',
        hooks: {
          beforeChange: [({ data }: HookArgs) => { calls.push('beforeChange'); return data }],
          afterChange: [({ data }: HookArgs) => { calls.push('afterChange'); return data }]
        }
      }
    ]
    await runFieldHooks('beforeChange', fields, { title: 'test' })
    expect(calls).toEqual(['beforeChange'])
  })

  it('chains data through multiple hooks on the same field', async () => {
    const fields: readonly FieldConfig[] = [
      {
        type: 'text',
        name: 'title',
        hooks: {
          beforeChange: [
            ({ data }: HookArgs) => ({ ...data, step1: true }),
            ({ data }: HookArgs) => ({ ...data, step2: true })
          ]
        }
      }
    ]
    const result = await runFieldHooks('beforeChange', fields, { title: 'test' })
    expect(result.isOk()).toBe(true)
    expect(result.unwrap()).toEqual({ title: 'test', step1: true, step2: true })
  })
})
