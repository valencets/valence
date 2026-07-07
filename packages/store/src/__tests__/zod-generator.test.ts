import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { generateStoreSchema } from '../validation/zod-generator.js'
import { field } from '../fields/index.js'

describe('generateStoreSchema', () => {
  it('generates schema for text field', () => {
    const schema = generateStoreSchema([field.text({ name: 'title' })])
    const result = schema.safeParse({ title: 'hello' })
    expect(result.success).toBe(true)
  })

  it('rejects non-string for text field', () => {
    const schema = generateStoreSchema([field.text({ name: 'title' })])
    const result = schema.safeParse({ title: 123 })
    expect(result.success).toBe(false)
  })

  it('enforces text minLength', () => {
    const schema = generateStoreSchema([field.text({ name: 'slug', minLength: 3 })])
    expect(schema.safeParse({ slug: 'ab' }).success).toBe(false)
    expect(schema.safeParse({ slug: 'abc' }).success).toBe(true)
  })

  it('enforces text maxLength', () => {
    const schema = generateStoreSchema([field.text({ name: 'code', maxLength: 5 })])
    expect(schema.safeParse({ code: 'toolong' }).success).toBe(false)
    expect(schema.safeParse({ code: 'ok' }).success).toBe(true)
  })

  it('generates schema for textarea field', () => {
    const schema = generateStoreSchema([field.textarea({ name: 'bio', maxLength: 1000 })])
    expect(schema.safeParse({ bio: 'a'.repeat(1000) }).success).toBe(true)
    expect(schema.safeParse({ bio: 'a'.repeat(1001) }).success).toBe(false)
  })

  it('generates schema for number field', () => {
    const schema = generateStoreSchema([field.number({ name: 'count' })])
    expect(schema.safeParse({ count: 42 }).success).toBe(true)
    expect(schema.safeParse({ count: '42' }).success).toBe(true) // coercion
    expect(schema.safeParse({ count: 'abc' }).success).toBe(false)
  })

  it('enforces number min and max', () => {
    const schema = generateStoreSchema([field.number({ name: 'qty', min: 1, max: 100 })])
    expect(schema.safeParse({ qty: 0 }).success).toBe(false)
    expect(schema.safeParse({ qty: 1 }).success).toBe(true)
    expect(schema.safeParse({ qty: 100 }).success).toBe(true)
    expect(schema.safeParse({ qty: 101 }).success).toBe(false)
  })

  it('generates schema for boolean field', () => {
    const schema = generateStoreSchema([field.boolean({ name: 'active' })])
    expect(schema.safeParse({ active: true }).success).toBe(true)
    expect(schema.safeParse({ active: false }).success).toBe(true)
    expect(schema.safeParse({ active: 'yes' }).success).toBe(false)
  })

  it('generates schema for select field', () => {
    const schema = generateStoreSchema([field.select({ name: 'status', options: ['draft', 'published'] })])
    expect(schema.safeParse({ status: 'draft' }).success).toBe(true)
    expect(schema.safeParse({ status: 'archived' }).success).toBe(false)
  })

  it('generates schema for multiselect field', () => {
    const schema = generateStoreSchema([field.multiselect({ name: 'tags', options: ['a', 'b', 'c'] })])
    expect(schema.safeParse({ tags: ['a', 'b'] }).success).toBe(true)
    expect(schema.safeParse({ tags: ['a', 'x'] }).success).toBe(false)
    expect(schema.safeParse({ tags: [] }).success).toBe(true)
  })

  it('generates schema for date field', () => {
    const schema = generateStoreSchema([field.date({ name: 'publishAt' })])
    expect(schema.safeParse({ publishAt: '2026-03-26T12:00:00Z' }).success).toBe(true)
    expect(schema.safeParse({ publishAt: 123 }).success).toBe(false)
  })

  it('generates schema for email field', () => {
    const schema = generateStoreSchema([field.email({ name: 'contact' })])
    expect(schema.safeParse({ contact: 'user@example.com' }).success).toBe(true)
    expect(schema.safeParse({ contact: 'notanemail' }).success).toBe(false)
  })

  it('generates schema for url field', () => {
    const schema = generateStoreSchema([field.url({ name: 'website' })])
    expect(schema.safeParse({ website: 'https://example.com' }).success).toBe(true)
    expect(schema.safeParse({ website: 'not a url' }).success).toBe(false)
  })

  it('generates schema for color field', () => {
    const schema = generateStoreSchema([field.color({ name: 'accent' })])
    expect(schema.safeParse({ accent: '#ff6600' }).success).toBe(true)
    expect(schema.safeParse({ accent: 'red' }).success).toBe(true) // color names accepted as strings
    expect(schema.safeParse({ accent: 123 }).success).toBe(false)
  })

  it('generates schema for slug field', () => {
    const schema = generateStoreSchema([field.slug({ name: 'handle' })])
    expect(schema.safeParse({ handle: 'my-post' }).success).toBe(true)
    expect(schema.safeParse({ handle: 123 }).success).toBe(false)
  })

  it('generates schema for json field', () => {
    const schema = generateStoreSchema([field.json({ name: 'meta' })])
    expect(schema.safeParse({ meta: { key: 'value' } }).success).toBe(true)
    expect(schema.safeParse({ meta: 'string' }).success).toBe(true)
    expect(schema.safeParse({ meta: 42 }).success).toBe(true)
  })

  it('generates schema for array field with nested fields', () => {
    const schema = generateStoreSchema([
      field.array({
        name: 'items',
        fields: [
          field.text({ name: 'sku' }),
          field.number({ name: 'qty', min: 1 })
        ]
      })
    ])
    expect(schema.safeParse({ items: [{ sku: 'abc', qty: 2 }] }).success).toBe(true)
    expect(schema.safeParse({ items: [{ sku: 'abc', qty: 0 }] }).success).toBe(false)
    expect(schema.safeParse({ items: 'not array' }).success).toBe(false)
  })

  it('generates schema for group field with nested fields', () => {
    const schema = generateStoreSchema([
      field.group({
        name: 'address',
        fields: [
          field.text({ name: 'street' }),
          field.text({ name: 'city' }),
          field.text({ name: 'zip', minLength: 5, maxLength: 5 })
        ]
      })
    ])
    expect(schema.safeParse({ address: { street: '123 Main', city: 'NY', zip: '10001' } }).success).toBe(true)
    expect(schema.safeParse({ address: { street: '123 Main', city: 'NY', zip: '100' } }).success).toBe(false)
  })

  it('composes multiple fields into one schema', () => {
    const schema = generateStoreSchema([
      field.text({ name: 'name' }),
      field.number({ name: 'age', min: 0 }),
      field.boolean({ name: 'active' }),
      field.select({ name: 'role', options: ['admin', 'user'] })
    ])
    expect(schema.safeParse({ name: 'Alice', age: 30, active: true, role: 'admin' }).success).toBe(true)
    expect(schema.safeParse({ name: 'Alice', age: -1, active: true, role: 'admin' }).success).toBe(false)
  })

  it('makes fields without required flag optional', () => {
    const schema = generateStoreSchema([
      field.text({ name: 'title' }),
      field.text({ name: 'subtitle' })
    ])
    // All store fields are optional by default (state can be partially populated)
    expect(schema.safeParse({ title: 'hello' }).success).toBe(true)
    expect(schema.safeParse({}).success).toBe(true)
  })

  it('generates schema for custom field using developer-provided validator', () => {
    const vec3 = z.object({ x: z.number(), y: z.number(), z: z.number() })
    const schema = generateStoreSchema([field.custom({ name: 'position', validator: vec3 })])
    expect(schema.safeParse({ position: { x: 1, y: 2, z: 3 } }).success).toBe(true)
    expect(schema.safeParse({ position: { x: 1, y: 'bad' } }).success).toBe(false)
  })

  it('custom field with primitive validator', () => {
    const schema = generateStoreSchema([
      field.custom({ name: 'score', validator: z.number().int().positive() })
    ])
    expect(schema.safeParse({ score: 42 }).success).toBe(true)
    expect(schema.safeParse({ score: -1 }).success).toBe(false)
    expect(schema.safeParse({ score: 3.5 }).success).toBe(false)
  })

  it('returns a ZodObject', () => {
    const schema = generateStoreSchema([field.text({ name: 'x' })])
    expect(schema).toBeInstanceOf(z.ZodObject)
  })
})
