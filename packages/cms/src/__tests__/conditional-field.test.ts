import { describe, it, expect } from 'vitest'
import { field } from '../schema/fields.js'
import type { FieldBaseConfig, TextFieldConfig } from '../schema/field-types.js'

describe('condition on FieldBaseConfig', () => {
  it('accepts a condition function on TextFieldConfig', () => {
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'premiumContent',
      condition: (data) => data['type'] === 'premium'
    }
    expect(fieldConfig.condition).toBeDefined()
    expect(typeof fieldConfig.condition).toBe('function')
  })

  it('condition function returns boolean when called', () => {
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'premiumContent',
      condition: (data) => data['type'] === 'premium'
    }
    const fn = fieldConfig.condition
    expect(fn?.({ type: 'premium' })).toBe(true)
    expect(fn?.({ type: 'free' })).toBe(false)
  })

  it('fields without condition still work (backward compat)', () => {
    const fieldConfig: TextFieldConfig = {
      type: 'text',
      name: 'title'
    }
    expect(fieldConfig.condition).toBeUndefined()
  })

  it('condition is optional on FieldBaseConfig', () => {
    const base: FieldBaseConfig = {
      name: 'title'
    }
    expect(base.condition).toBeUndefined()
  })
})

describe('field factories with condition', () => {
  it('field.text() preserves condition through factory', () => {
    const conditionFn = (data: Record<string, string>): boolean => data['status'] === 'active'
    const f = field.text({ name: 'activeOnly', condition: conditionFn })
    expect(f.condition).toBe(conditionFn)
  })

  it('field.textarea() accepts condition', () => {
    const conditionFn = (data: Record<string, string>): boolean => data['type'] === 'article'
    const f = field.textarea({ name: 'body', condition: conditionFn })
    expect(f.condition).toBe(conditionFn)
    expect(f.condition?.({ type: 'article' })).toBe(true)
  })

  it('field.number() accepts condition', () => {
    const f = field.number({ name: 'price', condition: (data) => data['hasPricing'] === 'true' })
    expect(f.condition).toBeDefined()
  })

  it('field.boolean() accepts condition', () => {
    const f = field.boolean({ name: 'active', condition: (data) => data['role'] === 'admin' })
    expect(f.condition).toBeDefined()
    expect(f.condition?.({ role: 'admin' })).toBe(true)
    expect(f.condition?.({ role: 'user' })).toBe(false)
  })

  it('field.select() accepts condition', () => {
    const f = field.select({
      name: 'plan',
      options: [{ label: 'Free', value: 'free' }, { label: 'Pro', value: 'pro' }],
      condition: (data) => data['isSubscribed'] === 'true'
    })
    expect(f.condition).toBeDefined()
  })

  it('field factories work without condition (backward compat)', () => {
    const f = field.text({ name: 'title' })
    expect(f.condition).toBeUndefined()
  })

  it('condition function receives a Record<string, string> arg', () => {
    const calls: Array<Record<string, string>> = []
    const conditionFn = (data: Record<string, string>): boolean => {
      calls.push(data)
      return data['x'] === '1'
    }
    const f = field.text({ name: 'test', condition: conditionFn })
    f.condition?.({ x: '1', y: '2' })
    expect(calls).toHaveLength(1)
    expect(calls[0]).toEqual({ x: '1', y: '2' })
  })
})
