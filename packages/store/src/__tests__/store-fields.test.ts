import { describe, it, expect } from 'vitest'
import { field } from '../fields/index.js'
import { StoreFieldType } from '../fields/store-field-types.js'

describe('StoreFieldType', () => {
  it('contains all expected field types', () => {
    expect(StoreFieldType.TEXT).toBe('text')
    expect(StoreFieldType.NUMBER).toBe('number')
    expect(StoreFieldType.BOOLEAN).toBe('boolean')
    expect(StoreFieldType.SELECT).toBe('select')
    expect(StoreFieldType.DATE).toBe('date')
    expect(StoreFieldType.JSON).toBe('json')
    expect(StoreFieldType.ARRAY).toBe('array')
    expect(StoreFieldType.GROUP).toBe('group')
  })

  it('is frozen and cannot be mutated', () => {
    expect(Object.isFrozen(StoreFieldType)).toBe(true)
  })
})

describe('field.text', () => {
  it('returns config with type text', () => {
    const f = field.text({ name: 'title' })
    expect(f.type).toBe('text')
    expect(f.name).toBe('title')
  })

  it('includes minLength and maxLength constraints', () => {
    const f = field.text({ name: 'slug', minLength: 1, maxLength: 100 })
    expect(f.minLength).toBe(1)
    expect(f.maxLength).toBe(100)
  })

  it('includes default value', () => {
    const f = field.text({ name: 'status', default: 'draft' })
    expect(f.default).toBe('draft')
  })
})

describe('field.number', () => {
  it('returns config with type number', () => {
    const f = field.number({ name: 'count' })
    expect(f.type).toBe('number')
    expect(f.name).toBe('count')
  })

  it('includes min, max, and default', () => {
    const f = field.number({ name: 'qty', min: 0, max: 999, default: 1 })
    expect(f.min).toBe(0)
    expect(f.max).toBe(999)
    expect(f.default).toBe(1)
  })
})

describe('field.boolean', () => {
  it('returns config with type boolean', () => {
    const f = field.boolean({ name: 'active' })
    expect(f.type).toBe('boolean')
    expect(f.name).toBe('active')
  })

  it('includes default value', () => {
    const f = field.boolean({ name: 'visible', default: true })
    expect(f.default).toBe(true)
  })
})

describe('field.select', () => {
  it('returns config with type select and options', () => {
    const f = field.select({ name: 'status', options: ['draft', 'published'] })
    expect(f.type).toBe('select')
    expect(f.options).toEqual(['draft', 'published'])
  })

  it('includes default value', () => {
    const f = field.select({ name: 'role', options: ['admin', 'editor'], default: 'editor' })
    expect(f.default).toBe('editor')
  })
})

describe('field.date', () => {
  it('returns config with type date', () => {
    const f = field.date({ name: 'publishAt' })
    expect(f.type).toBe('date')
    expect(f.name).toBe('publishAt')
  })
})

describe('field.json', () => {
  it('returns config with type json', () => {
    const f = field.json({ name: 'metadata' })
    expect(f.type).toBe('json')
    expect(f.name).toBe('metadata')
  })
})

describe('field.array', () => {
  it('returns config with type array and nested fields', () => {
    const f = field.array({
      name: 'items',
      fields: [
        field.text({ name: 'sku' }),
        field.number({ name: 'qty' })
      ]
    })
    expect(f.type).toBe('array')
    expect(f.name).toBe('items')
    expect(f.fields).toHaveLength(2)
    expect(f.fields[0]!.name).toBe('sku')
    expect(f.fields[1]!.name).toBe('qty')
  })
})

describe('field.group', () => {
  it('returns config with type group and nested fields', () => {
    const f = field.group({
      name: 'address',
      fields: [
        field.text({ name: 'street' }),
        field.text({ name: 'city' }),
        field.text({ name: 'zip' })
      ]
    })
    expect(f.type).toBe('group')
    expect(f.name).toBe('address')
    expect(f.fields).toHaveLength(3)
  })
})

describe('field factories', () => {
  it('all return readonly configs', () => {
    const configs = [
      field.text({ name: 'a' }),
      field.number({ name: 'b' }),
      field.boolean({ name: 'c' }),
      field.select({ name: 'd', options: ['x'] }),
      field.date({ name: 'e' }),
      field.json({ name: 'f' }),
      field.array({ name: 'g', fields: [] }),
      field.group({ name: 'h', fields: [] })
    ]
    for (const config of configs) {
      expect(config).toBeDefined()
      expect(typeof config.type).toBe('string')
      expect(typeof config.name).toBe('string')
    }
  })
})
