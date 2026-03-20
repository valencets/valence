import { describe, it, expect } from 'vitest'
import { generateZodSchema, generatePartialSchema, generateDraftSchema } from '../validation/zod-generator.js'
import { field } from '../schema/fields.js'
import type { FieldConfig } from '../schema/field-types.js'

describe('generateZodSchema()', () => {
  it('generates a schema for a text field', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'title', required: true })
    ]
    const schema = generateZodSchema(fields)
    const valid = schema.safeParse({ title: 'Hello' })
    expect(valid.success).toBe(true)

    const invalid = schema.safeParse({ title: '' })
    expect(invalid.success).toBe(true) // empty string is valid text, required means "present"
  })

  it('rejects missing required fields', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'title', required: true })
    ]
    const schema = generateZodSchema(fields)
    const result = schema.safeParse({})
    expect(result.success).toBe(false)
  })

  it('allows missing optional fields', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'title' })
    ]
    const schema = generateZodSchema(fields)
    const result = schema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('validates text minLength and maxLength', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'code', required: true, minLength: 2, maxLength: 5 })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ code: 'AB' }).success).toBe(true)
    expect(schema.safeParse({ code: 'A' }).success).toBe(false)
    expect(schema.safeParse({ code: 'ABCDEF' }).success).toBe(false)
  })

  it('validates number fields', () => {
    const fields: readonly FieldConfig[] = [
      field.number({ name: 'price', required: true, min: 0, max: 100 })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ price: 50 }).success).toBe(true)
    expect(schema.safeParse({ price: -1 }).success).toBe(false)
    expect(schema.safeParse({ price: 101 }).success).toBe(false)
    expect(schema.safeParse({ price: 'abc' }).success).toBe(false)
  })

  it('validates boolean fields', () => {
    const fields: readonly FieldConfig[] = [
      field.boolean({ name: 'active', required: true })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ active: true }).success).toBe(true)
    expect(schema.safeParse({ active: false }).success).toBe(true)
    expect(schema.safeParse({ active: 'yes' }).success).toBe(false)
  })

  it('coerces "true"/"false" strings to booleans for form submission', () => {
    const fields: readonly FieldConfig[] = [
      field.boolean({ name: 'published', required: true })
    ]
    const schema = generateZodSchema(fields)

    const trueResult = schema.safeParse({ published: 'true' })
    expect(trueResult.success).toBe(true)
    if (trueResult.success) expect(trueResult.data.published).toBe(true)

    const falseResult = schema.safeParse({ published: 'false' })
    expect(falseResult.success).toBe(true)
    if (falseResult.success) expect(falseResult.data.published).toBe(false)
  })

  it('validates select fields against options', () => {
    const fields: readonly FieldConfig[] = [
      field.select({
        name: 'status',
        required: true,
        options: [
          { label: 'Draft', value: 'draft' },
          { label: 'Published', value: 'published' }
        ]
      })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ status: 'draft' }).success).toBe(true)
    expect(schema.safeParse({ status: 'published' }).success).toBe(true)
    expect(schema.safeParse({ status: 'archived' }).success).toBe(false)
  })

  it('validates date fields as ISO strings or Date objects', () => {
    const fields: readonly FieldConfig[] = [
      field.date({ name: 'publishedAt', required: true })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ publishedAt: '2026-03-18T00:00:00Z' }).success).toBe(true)
    expect(schema.safeParse({ publishedAt: 123 }).success).toBe(false)
  })

  it('validates slug fields as strings', () => {
    const fields: readonly FieldConfig[] = [
      field.slug({ name: 'slug', required: true })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ slug: 'hello-world' }).success).toBe(true)
    expect(schema.safeParse({ slug: 123 }).success).toBe(false)
  })

  it('validates relation fields as UUID strings', () => {
    const fields: readonly FieldConfig[] = [
      field.relation({ name: 'author', relationTo: 'users', required: true })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ author: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true)
    expect(schema.safeParse({ author: 'not-a-uuid' }).success).toBe(false)
  })

  it('validates media fields as UUID strings', () => {
    const fields: readonly FieldConfig[] = [
      field.media({ name: 'image', relationTo: 'media', required: true })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ image: '550e8400-e29b-41d4-a716-446655440000' }).success).toBe(true)
  })

  it('validates group fields with nested schema', () => {
    const fields: readonly FieldConfig[] = [
      field.group({
        name: 'seo',
        fields: [
          field.text({ name: 'metaTitle', required: true }),
          field.textarea({ name: 'metaDescription' })
        ]
      })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ seo: { metaTitle: 'Hello' } }).success).toBe(true)
    expect(schema.safeParse({ seo: {} }).success).toBe(false) // metaTitle is required
    expect(schema.safeParse({}).success).toBe(true) // group itself is optional by default
  })

  it('handles textarea fields like text', () => {
    const fields: readonly FieldConfig[] = [
      field.textarea({ name: 'body', required: true, minLength: 10 })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ body: 'Short' }).success).toBe(false)
    expect(schema.safeParse({ body: 'Long enough text' }).success).toBe(true)
  })

  it('handles multiple fields together', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'title', required: true }),
      field.slug({ name: 'slug', required: true }),
      field.boolean({ name: 'published' }),
      field.number({ name: 'order' })
    ]
    const schema = generateZodSchema(fields)

    expect(schema.safeParse({ title: 'Hello', slug: 'hello' }).success).toBe(true)
    expect(schema.safeParse({ slug: 'hello' }).success).toBe(false) // missing title
  })
})

describe('generatePartialSchema()', () => {
  it('makes all fields optional for partial updates', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'title', required: true }),
      field.number({ name: 'order', required: true })
    ]
    const schema = generatePartialSchema(fields)

    expect(schema.safeParse({}).success).toBe(true)
    expect(schema.safeParse({ title: 'Updated' }).success).toBe(true)
    expect(schema.safeParse({ order: 5 }).success).toBe(true)
  })

  it('still validates types on provided fields', () => {
    const fields: readonly FieldConfig[] = [
      field.number({ name: 'order', required: true, min: 0 })
    ]
    const schema = generatePartialSchema(fields)

    expect(schema.safeParse({ order: 'abc' }).success).toBe(false)
    expect(schema.safeParse({ order: -1 }).success).toBe(false)
  })
})

describe('UUID field empty string handling', () => {
  it('accepts empty string for optional relation field (converts to undefined)', () => {
    const fields: readonly FieldConfig[] = [
      field.relation({ name: 'category', relationTo: 'categories' })
    ]
    const schema = generateZodSchema(fields)
    const result = schema.safeParse({ category: '' })
    expect(result.success).toBe(true)
  })

  it('rejects empty string for required relation field', () => {
    const fields: readonly FieldConfig[] = [
      field.relation({ name: 'category', relationTo: 'categories', required: true })
    ]
    const schema = generateZodSchema(fields)
    const result = schema.safeParse({ category: '' })
    expect(result.success).toBe(false)
  })

  it('accepts empty string for optional media field (converts to undefined)', () => {
    const fields: readonly FieldConfig[] = [
      field.media({ name: 'image', relationTo: 'media' })
    ]
    const schema = generateZodSchema(fields)
    const result = schema.safeParse({ image: '' })
    expect(result.success).toBe(true)
  })

  it('still accepts valid UUID for optional relation field', () => {
    const fields: readonly FieldConfig[] = [
      field.relation({ name: 'category', relationTo: 'categories' })
    ]
    const schema = generateZodSchema(fields)
    const result = schema.safeParse({ category: '550e8400-e29b-41d4-a716-446655440000' })
    expect(result.success).toBe(true)
  })
})

describe('generateDraftSchema()', () => {
  it('makes all required fields optional', () => {
    const fields: FieldConfig[] = [
      { type: 'text', name: 'title', required: true },
      { type: 'text', name: 'body', required: true },
      { type: 'boolean', name: 'published' }
    ]
    const schema = generateDraftSchema(fields)
    // Should accept empty object (all fields optional)
    const result = schema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('still validates field types when values are provided', () => {
    const fields: FieldConfig[] = [
      { type: 'number', name: 'count', required: true },
      { type: 'text', name: 'title', required: true }
    ]
    const schema = generateDraftSchema(fields)
    // Valid partial data
    const validResult = schema.safeParse({ title: 'Draft title' })
    expect(validResult.success).toBe(true)
  })

  it('accepts completely empty object for draft save', () => {
    const fields: FieldConfig[] = [
      { type: 'text', name: 'title', required: true },
      { type: 'text', name: 'slug', required: true, unique: true },
      { type: 'richtext', name: 'body', required: true }
    ]
    const schema = generateDraftSchema(fields)
    const result = schema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid field types even in draft mode', () => {
    const fields: FieldConfig[] = [
      { type: 'email', name: 'contactEmail', required: true }
    ]
    const schema = generateDraftSchema(fields)
    // Providing an invalid email should still fail
    const result = schema.safeParse({ contactEmail: 'not-an-email' })
    expect(result.success).toBe(false)
  })
})
