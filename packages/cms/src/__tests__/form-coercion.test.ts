import { describe, it, expect } from 'vitest'
import { generateZodSchema } from '../validation/zod-generator.js'
import { field } from '../schema/fields.js'

describe('form value coercion via Zod schemas', () => {
  it('coerces string "true" to boolean true for checkbox fields', () => {
    const schema = generateZodSchema([field.boolean({ name: 'published' })])
    const result = schema.safeParse({ published: 'true' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.published).toBe(true)
    }
  })

  it('coerces string "false" to boolean false for unchecked checkbox', () => {
    const schema = generateZodSchema([field.boolean({ name: 'published' })])
    const result = schema.safeParse({ published: 'false' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.published).toBe(false)
    }
  })

  it('coerces string number to actual number for number fields', () => {
    const schema = generateZodSchema([field.number({ name: 'order', required: true })])
    const result = schema.safeParse({ order: '5' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.order).toBe(5)
    }
  })

  it('rejects non-numeric string for number fields', () => {
    const schema = generateZodSchema([field.number({ name: 'order', required: true })])
    const result = schema.safeParse({ order: 'abc' })
    expect(result.success).toBe(false)
  })

  it('strips empty date string to undefined for optional date fields', () => {
    const schema = generateZodSchema([field.date({ name: 'publishedAt' })])
    const result = schema.safeParse({ publishedAt: '' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.publishedAt).toBeUndefined()
    }
  })

  it('rejects empty date string for required date fields', () => {
    const schema = generateZodSchema([field.date({ name: 'publishedAt', required: true })])
    const result = schema.safeParse({ publishedAt: '' })
    expect(result.success).toBe(false)
  })

  it('passes through valid date string', () => {
    const schema = generateZodSchema([field.date({ name: 'publishedAt', required: true })])
    const result = schema.safeParse({ publishedAt: '2026-03-18' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.publishedAt).toBe('2026-03-18')
    }
  })
})
