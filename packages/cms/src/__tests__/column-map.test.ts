import { describe, it, expect } from 'vitest'
import { getColumnType, getColumnConstraints } from '../db/column-map.js'
import { field } from '../schema/fields.js'

describe('getColumnType()', () => {
  it('maps text → TEXT', () => {
    expect(getColumnType(field.text({ name: 'title' }))).toBe('TEXT')
  })

  it('maps textarea → TEXT', () => {
    expect(getColumnType(field.textarea({ name: 'body' }))).toBe('TEXT')
  })

  it('maps number without decimals → INTEGER', () => {
    expect(getColumnType(field.number({ name: 'order' }))).toBe('INTEGER')
  })

  it('maps number with decimals → NUMERIC', () => {
    expect(getColumnType(field.number({ name: 'price', hasDecimals: true }))).toBe('NUMERIC')
  })

  it('maps boolean → BOOLEAN', () => {
    expect(getColumnType(field.boolean({ name: 'active' }))).toBe('BOOLEAN')
  })

  it('maps select → TEXT', () => {
    expect(getColumnType(field.select({
      name: 'status',
      options: [{ label: 'A', value: 'a' }]
    }))).toBe('TEXT')
  })

  it('maps date → TIMESTAMPTZ', () => {
    expect(getColumnType(field.date({ name: 'publishedAt' }))).toBe('TIMESTAMPTZ')
  })

  it('maps slug → TEXT', () => {
    expect(getColumnType(field.slug({ name: 'slug' }))).toBe('TEXT')
  })

  it('maps media → UUID', () => {
    expect(getColumnType(field.media({ name: 'image', relationTo: 'media' }))).toBe('UUID')
  })

  it('maps relation → UUID', () => {
    expect(getColumnType(field.relation({ name: 'author', relationTo: 'users' }))).toBe('UUID')
  })

  it('maps group → JSONB', () => {
    expect(getColumnType(field.group({ name: 'meta', fields: [] }))).toBe('JSONB')
  })
})

describe('getColumnConstraints()', () => {
  it('adds NOT NULL for required fields', () => {
    const constraints = getColumnConstraints(field.text({ name: 'title', required: true }))
    expect(constraints).toContain('NOT NULL')
  })

  it('adds UNIQUE for unique fields', () => {
    const constraints = getColumnConstraints(field.text({ name: 'email', unique: true }))
    expect(constraints).toContain('UNIQUE')
  })

  it('adds CHECK constraint for select fields', () => {
    const constraints = getColumnConstraints(field.select({
      name: 'status',
      options: [
        { label: 'Draft', value: 'draft' },
        { label: 'Published', value: 'published' }
      ]
    }))
    expect(constraints).toContain('CHECK')
    expect(constraints).toContain("'draft'")
    expect(constraints).toContain("'published'")
  })

  it('returns empty string for optional field with no constraints', () => {
    const constraints = getColumnConstraints(field.text({ name: 'bio' }))
    expect(constraints).toBe('')
  })
})
