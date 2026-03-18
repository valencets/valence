import { describe, it, expect } from 'vitest'
import { field } from '../schema/fields.js'

describe('field.text()', () => {
  it('returns a TextFieldConfig with type text', () => {
    const f = field.text({ name: 'title' })
    expect(f.type).toBe('text')
    expect(f.name).toBe('title')
  })

  it('passes through shared and text-specific options', () => {
    const f = field.text({ name: 'title', required: true, maxLength: 255 })
    expect(f.required).toBe(true)
    expect(f.maxLength).toBe(255)
  })
})

describe('field.textarea()', () => {
  it('returns a TextareaFieldConfig', () => {
    const f = field.textarea({ name: 'body' })
    expect(f.type).toBe('textarea')
    expect(f.name).toBe('body')
  })
})

describe('field.number()', () => {
  it('returns a NumberFieldConfig with constraints', () => {
    const f = field.number({ name: 'price', min: 0, hasDecimals: true })
    expect(f.type).toBe('number')
    expect(f.min).toBe(0)
    expect(f.hasDecimals).toBe(true)
  })
})

describe('field.boolean()', () => {
  it('returns a BooleanFieldConfig', () => {
    const f = field.boolean({ name: 'active' })
    expect(f.type).toBe('boolean')
  })
})

describe('field.select()', () => {
  it('returns a SelectFieldConfig with options', () => {
    const f = field.select({
      name: 'status',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' }
      ]
    })
    expect(f.type).toBe('select')
    expect(f.options).toHaveLength(2)
  })
})

describe('field.date()', () => {
  it('returns a DateFieldConfig', () => {
    const f = field.date({ name: 'publishedAt' })
    expect(f.type).toBe('date')
  })
})

describe('field.slug()', () => {
  it('returns a SlugFieldConfig with slugFrom', () => {
    const f = field.slug({ name: 'slug', slugFrom: 'title' })
    expect(f.type).toBe('slug')
    expect(f.slugFrom).toBe('title')
  })
})

describe('field.media()', () => {
  it('returns a MediaFieldConfig', () => {
    const f = field.media({ name: 'image', relationTo: 'media' })
    expect(f.type).toBe('media')
    expect(f.relationTo).toBe('media')
  })
})

describe('field.relation()', () => {
  it('returns a RelationFieldConfig', () => {
    const f = field.relation({ name: 'author', relationTo: 'users', hasMany: false })
    expect(f.type).toBe('relation')
    expect(f.hasMany).toBe(false)
  })
})

describe('field.group()', () => {
  it('returns a GroupFieldConfig with nested fields', () => {
    const f = field.group({
      name: 'seo',
      fields: [
        field.text({ name: 'metaTitle' }),
        field.textarea({ name: 'metaDescription' })
      ]
    })
    expect(f.type).toBe('group')
    expect(f.fields).toHaveLength(2)
    expect(f.fields[0]?.type).toBe('text')
    expect(f.fields[1]?.type).toBe('textarea')
  })
})
