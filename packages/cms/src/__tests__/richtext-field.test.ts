import { describe, it, expect } from 'vitest'
import { field } from '../schema/fields.js'
import { FieldType } from '../schema/field-types.js'
import type { RichtextFieldConfig } from '../schema/field-types.js'
import { getColumnType } from '../db/column-map.js'
import { generateZodSchema } from '../validation/zod-generator.js'

describe('richtext field type', () => {
  it('FieldType enum includes RICHTEXT', () => {
    expect(FieldType.RICHTEXT).toBe('richtext')
  })

  it('field.richtext() creates a RichtextFieldConfig', () => {
    const f = field.richtext({ name: 'content' })
    expect(f.type).toBe('richtext')
    expect(f.name).toBe('content')
  })

  it('field.richtext() accepts optional minLength/maxLength', () => {
    const f = field.richtext({ name: 'body', minLength: 10, maxLength: 50000 }) as RichtextFieldConfig
    expect(f.minLength).toBe(10)
    expect(f.maxLength).toBe(50000)
  })

  it('maps to TEXT column type', () => {
    const f = field.richtext({ name: 'content' })
    expect(getColumnType(f)).toBe('TEXT')
  })

  it('generates z.string() Zod schema', () => {
    const f = field.richtext({ name: 'content', required: true })
    const schema = generateZodSchema([f])
    const result = schema.safeParse({ content: '<p>Hello</p>' })
    expect(result.success).toBe(true)
  })

  it('Zod schema rejects non-string values', () => {
    const f = field.richtext({ name: 'content', required: true })
    const schema = generateZodSchema([f])
    const result = schema.safeParse({ content: 123 })
    expect(result.success).toBe(false)
  })
})
