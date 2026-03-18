import { describe, it, expect } from 'vitest'
import { FieldType } from '../schema/field-types.js'
import type { FieldConfig, TextFieldConfig, TextareaFieldConfig, NumberFieldConfig, BooleanFieldConfig, SelectFieldConfig, DateFieldConfig, SlugFieldConfig, MediaFieldConfig, RelationFieldConfig, GroupFieldConfig } from '../schema/field-types.js'

describe('FieldType', () => {
  it('exposes all 10 v0.1 field types', () => {
    expect(FieldType.TEXT).toBe('text')
    expect(FieldType.TEXTAREA).toBe('textarea')
    expect(FieldType.NUMBER).toBe('number')
    expect(FieldType.BOOLEAN).toBe('boolean')
    expect(FieldType.SELECT).toBe('select')
    expect(FieldType.DATE).toBe('date')
    expect(FieldType.SLUG).toBe('slug')
    expect(FieldType.MEDIA).toBe('media')
    expect(FieldType.RELATION).toBe('relation')
    expect(FieldType.GROUP).toBe('group')
  })

  it('has exactly 10 types', () => {
    expect(Object.keys(FieldType)).toHaveLength(10)
  })
})

describe('TextFieldConfig', () => {
  it('requires type text and name', () => {
    const field: TextFieldConfig = {
      type: 'text',
      name: 'title'
    }
    expect(field.type).toBe('text')
    expect(field.name).toBe('title')
  })

  it('accepts optional shared base options', () => {
    const field: TextFieldConfig = {
      type: 'text',
      name: 'title',
      required: true,
      unique: true,
      index: true,
      hidden: false,
      localized: true
    }
    expect(field.required).toBe(true)
    expect(field.unique).toBe(true)
  })

  it('accepts text-specific options', () => {
    const field: TextFieldConfig = {
      type: 'text',
      name: 'title',
      minLength: 1,
      maxLength: 255
    }
    expect(field.minLength).toBe(1)
    expect(field.maxLength).toBe(255)
  })
})

describe('TextareaFieldConfig', () => {
  it('has type textarea', () => {
    const field: TextareaFieldConfig = { type: 'textarea', name: 'body' }
    expect(field.type).toBe('textarea')
  })
})

describe('NumberFieldConfig', () => {
  it('accepts min/max constraints', () => {
    const field: NumberFieldConfig = {
      type: 'number',
      name: 'price',
      min: 0,
      max: 99999,
      hasDecimals: true
    }
    expect(field.min).toBe(0)
    expect(field.hasDecimals).toBe(true)
  })
})

describe('BooleanFieldConfig', () => {
  it('has type boolean', () => {
    const field: BooleanFieldConfig = { type: 'boolean', name: 'published' }
    expect(field.type).toBe('boolean')
  })
})

describe('SelectFieldConfig', () => {
  it('requires options array', () => {
    const field: SelectFieldConfig = {
      type: 'select',
      name: 'status',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' }
      ]
    }
    expect(field.options).toHaveLength(2)
    expect(field.options[0]?.label).toBe('Draft')
  })
})

describe('DateFieldConfig', () => {
  it('has type date', () => {
    const field: DateFieldConfig = { type: 'date', name: 'publishedAt' }
    expect(field.type).toBe('date')
  })
})

describe('SlugFieldConfig', () => {
  it('accepts slugFrom to auto-generate from another field', () => {
    const field: SlugFieldConfig = {
      type: 'slug',
      name: 'slug',
      slugFrom: 'title'
    }
    expect(field.slugFrom).toBe('title')
  })
})

describe('MediaFieldConfig', () => {
  it('has type media and accepts relationTo', () => {
    const field: MediaFieldConfig = {
      type: 'media',
      name: 'featuredImage',
      relationTo: 'media'
    }
    expect(field.relationTo).toBe('media')
  })
})

describe('RelationFieldConfig', () => {
  it('accepts relationTo and hasMany', () => {
    const field: RelationFieldConfig = {
      type: 'relation',
      name: 'author',
      relationTo: 'users',
      hasMany: false
    }
    expect(field.relationTo).toBe('users')
    expect(field.hasMany).toBe(false)
  })
})

describe('GroupFieldConfig', () => {
  it('accepts nested fields array', () => {
    const field: GroupFieldConfig = {
      type: 'group',
      name: 'seo',
      fields: [
        { type: 'text', name: 'metaTitle' },
        { type: 'textarea', name: 'metaDescription' }
      ]
    }
    expect(field.fields).toHaveLength(2)
  })
})

describe('FieldConfig union', () => {
  it('discriminates on type property', () => {
    const fields: FieldConfig[] = [
      { type: 'text', name: 'title' },
      { type: 'number', name: 'order' },
      { type: 'boolean', name: 'active' },
      { type: 'select', name: 'status', options: [{ label: 'A', value: 'a' }] },
      { type: 'date', name: 'created' },
      { type: 'slug', name: 'slug' },
      { type: 'media', name: 'image', relationTo: 'media' },
      { type: 'relation', name: 'author', relationTo: 'users' },
      { type: 'textarea', name: 'body' },
      { type: 'group', name: 'meta', fields: [] }
    ]
    expect(fields).toHaveLength(10)
    const types = fields.map(f => f.type)
    expect(new Set(types).size).toBe(10)
  })
})
