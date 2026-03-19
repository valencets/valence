import { describe, it, expect } from 'vitest'
import { FieldType } from '../schema/field-types.js'
import type {
  FieldConfig,
  EmailFieldConfig,
  UrlFieldConfig,
  PasswordFieldConfig,
  JsonFieldConfig,
  ColorFieldConfig,
  MultiselectFieldConfig,
  ArrayFieldConfig
} from '../schema/field-types.js'
import { field } from '../schema/fields.js'
import { getColumnType } from '../db/column-map.js'
import { generateZodSchema } from '../validation/zod-generator.js'
import { renderFieldInput } from '../admin/field-renderers.js'

// --- FieldType enum ---

describe('FieldType — new types', () => {
  it('has EMAIL constant', () => {
    expect(FieldType.EMAIL).toBe('email')
  })

  it('has URL constant', () => {
    expect(FieldType.URL).toBe('url')
  })

  it('has PASSWORD constant', () => {
    expect(FieldType.PASSWORD).toBe('password')
  })

  it('has JSON constant', () => {
    expect(FieldType.JSON).toBe('json')
  })

  it('has COLOR constant', () => {
    expect(FieldType.COLOR).toBe('color')
  })

  it('has MULTISELECT constant', () => {
    expect(FieldType.MULTISELECT).toBe('multiselect')
  })

  it('has ARRAY constant', () => {
    expect(FieldType.ARRAY).toBe('array')
  })

  it('has exactly 18 types total', () => {
    expect(Object.keys(FieldType)).toHaveLength(18)
  })
})

// --- Config interfaces ---

describe('EmailFieldConfig', () => {
  it('requires type email and name', () => {
    const f: EmailFieldConfig = { type: 'email', name: 'contactEmail' }
    expect(f.type).toBe('email')
    expect(f.name).toBe('contactEmail')
  })
})

describe('UrlFieldConfig', () => {
  it('requires type url and name', () => {
    const f: UrlFieldConfig = { type: 'url', name: 'website' }
    expect(f.type).toBe('url')
    expect(f.name).toBe('website')
  })
})

describe('PasswordFieldConfig', () => {
  it('requires type password and name', () => {
    const f: PasswordFieldConfig = { type: 'password', name: 'secret' }
    expect(f.type).toBe('password')
    expect(f.name).toBe('secret')
  })

  it('accepts minLength/maxLength', () => {
    const f: PasswordFieldConfig = { type: 'password', name: 'secret', minLength: 8, maxLength: 128 }
    expect(f.minLength).toBe(8)
  })
})

describe('JsonFieldConfig', () => {
  it('requires type json and name', () => {
    const f: JsonFieldConfig = { type: 'json', name: 'metadata' }
    expect(f.type).toBe('json')
    expect(f.name).toBe('metadata')
  })
})

describe('ColorFieldConfig', () => {
  it('requires type color and name', () => {
    const f: ColorFieldConfig = { type: 'color', name: 'brandColor' }
    expect(f.type).toBe('color')
    expect(f.name).toBe('brandColor')
  })
})

describe('MultiselectFieldConfig', () => {
  it('requires type multiselect, name, and options', () => {
    const f: MultiselectFieldConfig = {
      type: 'multiselect',
      name: 'tags',
      options: [
        { label: 'Tech', value: 'tech' },
        { label: 'Design', value: 'design' }
      ]
    }
    expect(f.type).toBe('multiselect')
    expect(f.options).toHaveLength(2)
  })
})

describe('ArrayFieldConfig', () => {
  it('requires type array, name, and fields', () => {
    const f: ArrayFieldConfig = {
      type: 'array',
      name: 'links',
      fields: [
        { type: 'text', name: 'label' },
        { type: 'url', name: 'href' }
      ]
    }
    expect(f.type).toBe('array')
    expect(f.fields).toHaveLength(2)
  })
})

// --- Factory functions ---

describe('field factories — new types', () => {
  it('field.email() creates EmailFieldConfig', () => {
    const f = field.email({ name: 'contactEmail' })
    expect(f.type).toBe('email')
    expect(f.name).toBe('contactEmail')
  })

  it('field.url() creates UrlFieldConfig', () => {
    const f = field.url({ name: 'website' })
    expect(f.type).toBe('url')
    expect(f.name).toBe('website')
  })

  it('field.password() creates PasswordFieldConfig', () => {
    const f = field.password({ name: 'secret', minLength: 8 })
    expect(f.type).toBe('password')
    expect(f.minLength).toBe(8)
  })

  it('field.json() creates JsonFieldConfig', () => {
    const f = field.json({ name: 'metadata' })
    expect(f.type).toBe('json')
  })

  it('field.color() creates ColorFieldConfig', () => {
    const f = field.color({ name: 'brandColor' })
    expect(f.type).toBe('color')
  })

  it('field.multiselect() creates MultiselectFieldConfig', () => {
    const f = field.multiselect({
      name: 'tags',
      options: [{ label: 'A', value: 'a' }]
    })
    expect(f.type).toBe('multiselect')
    expect(f.options).toHaveLength(1)
  })

  it('field.array() creates ArrayFieldConfig', () => {
    const f = field.array({
      name: 'links',
      fields: [{ type: 'text', name: 'label' }]
    })
    expect(f.type).toBe('array')
    expect(f.fields).toHaveLength(1)
  })
})

// --- Column mappings ---

describe('getColumnType() — new types', () => {
  it('maps email → TEXT', () => {
    expect(getColumnType(field.email({ name: 'email' }))).toBe('TEXT')
  })

  it('maps url → TEXT', () => {
    expect(getColumnType(field.url({ name: 'website' }))).toBe('TEXT')
  })

  it('maps password → TEXT', () => {
    expect(getColumnType(field.password({ name: 'secret' }))).toBe('TEXT')
  })

  it('maps json → JSONB', () => {
    expect(getColumnType(field.json({ name: 'metadata' }))).toBe('JSONB')
  })

  it('maps color → TEXT', () => {
    expect(getColumnType(field.color({ name: 'brandColor' }))).toBe('TEXT')
  })

  it('maps multiselect → JSONB', () => {
    expect(getColumnType(field.multiselect({
      name: 'tags',
      options: [{ label: 'A', value: 'a' }]
    }))).toBe('JSONB')
  })

  it('maps array → JSONB', () => {
    expect(getColumnType(field.array({
      name: 'links',
      fields: [{ type: 'text', name: 'label' }]
    }))).toBe('JSONB')
  })
})

// --- Zod validation ---

describe('generateZodSchema() — new types', () => {
  it('validates email format', () => {
    const schema = generateZodSchema([field.email({ name: 'email', required: true })])
    expect(schema.safeParse({ email: 'user@example.com' }).success).toBe(true)
    expect(schema.safeParse({ email: 'not-an-email' }).success).toBe(false)
  })

  it('validates url format', () => {
    const schema = generateZodSchema([field.url({ name: 'website', required: true })])
    expect(schema.safeParse({ website: 'https://example.com' }).success).toBe(true)
    expect(schema.safeParse({ website: 'not-a-url' }).success).toBe(false)
  })

  it('validates password as string with minLength', () => {
    const schema = generateZodSchema([field.password({ name: 'pw', required: true, minLength: 8 })])
    expect(schema.safeParse({ pw: 'longenough' }).success).toBe(true)
    expect(schema.safeParse({ pw: 'short' }).success).toBe(false)
  })

  it('validates json as parseable JSON string', () => {
    const schema = generateZodSchema([field.json({ name: 'data', required: true })])
    expect(schema.safeParse({ data: '{"key":"value"}' }).success).toBe(true)
    expect(schema.safeParse({ data: 'not json{' }).success).toBe(false)
  })

  it('validates color as hex color string', () => {
    const schema = generateZodSchema([field.color({ name: 'c', required: true })])
    expect(schema.safeParse({ c: '#ff0000' }).success).toBe(true)
    expect(schema.safeParse({ c: '#FFF' }).success).toBe(true)
    expect(schema.safeParse({ c: 'red' }).success).toBe(false)
  })

  it('validates multiselect as string array against options', () => {
    const schema = generateZodSchema([field.multiselect({
      name: 'tags',
      required: true,
      options: [
        { label: 'Tech', value: 'tech' },
        { label: 'Design', value: 'design' }
      ]
    })])
    expect(schema.safeParse({ tags: ['tech', 'design'] }).success).toBe(true)
    expect(schema.safeParse({ tags: ['invalid'] }).success).toBe(false)
    expect(schema.safeParse({ tags: [] }).success).toBe(true)
  })

  it('validates array as JSON array', () => {
    const schema = generateZodSchema([field.array({
      name: 'links',
      required: true,
      fields: [
        { type: 'text', name: 'label' },
        { type: 'url', name: 'href' }
      ]
    })])
    expect(schema.safeParse({
      links: [{ label: 'Home', href: 'https://example.com' }]
    }).success).toBe(true)
    expect(schema.safeParse({ links: 'not-an-array' }).success).toBe(false)
  })
})

// --- HTML renderers ---

describe('renderFieldInput() — new types', () => {
  it('renders email as input type="email"', () => {
    const html = renderFieldInput(field.email({ name: 'email' }), 'test@example.com')
    expect(html).toContain('type="email"')
    expect(html).toContain('name="email"')
    expect(html).toContain('value="test@example.com"')
  })

  it('renders url as input type="url"', () => {
    const html = renderFieldInput(field.url({ name: 'website' }), 'https://example.com')
    expect(html).toContain('type="url"')
    expect(html).toContain('name="website"')
  })

  it('renders password as input type="password"', () => {
    const html = renderFieldInput(field.password({ name: 'secret' }), '')
    expect(html).toContain('type="password"')
    expect(html).toContain('name="secret"')
  })

  it('renders json as textarea with monospace class', () => {
    const html = renderFieldInput(field.json({ name: 'data' }), '{"key":"value"}')
    expect(html).toContain('<textarea')
    expect(html).toContain('form-json')
    expect(html).toContain('name="data"')
  })

  it('renders color as input type="color"', () => {
    const html = renderFieldInput(field.color({ name: 'c' }), '#ff0000')
    expect(html).toContain('type="color"')
    expect(html).toContain('name="c"')
    expect(html).toContain('value="#ff0000"')
  })

  it('renders multiselect as select with multiple attribute', () => {
    const html = renderFieldInput(field.multiselect({
      name: 'tags',
      options: [
        { label: 'Tech', value: 'tech' },
        { label: 'Design', value: 'design' }
      ]
    }), '')
    expect(html).toContain('multiple')
    expect(html).toContain('name="tags"')
    expect(html).toContain('<option')
  })

  it('renders array with add-row button', () => {
    const html = renderFieldInput(field.array({
      name: 'links',
      fields: [{ type: 'text', name: 'label' }]
    }), '[]')
    expect(html).toContain('array-field')
    expect(html).toContain('name="links"')
  })
})

// --- FieldConfig union includes new types ---

describe('FieldConfig union — 18 types', () => {
  it('discriminates all 18 types', () => {
    const fields: FieldConfig[] = [
      { type: 'text', name: 'a' },
      { type: 'textarea', name: 'b' },
      { type: 'richtext', name: 'c' },
      { type: 'number', name: 'd' },
      { type: 'boolean', name: 'e' },
      { type: 'select', name: 'f', options: [{ label: 'X', value: 'x' }] },
      { type: 'date', name: 'g' },
      { type: 'slug', name: 'h' },
      { type: 'media', name: 'i', relationTo: 'media' },
      { type: 'relation', name: 'j', relationTo: 'users' },
      { type: 'group', name: 'k', fields: [] },
      { type: 'email', name: 'l' },
      { type: 'url', name: 'm' },
      { type: 'password', name: 'n' },
      { type: 'json', name: 'o' },
      { type: 'color', name: 'p' },
      { type: 'multiselect', name: 'q', options: [{ label: 'A', value: 'a' }] },
      { type: 'array', name: 'r', fields: [{ type: 'text', name: 'sub' }] }
    ]
    expect(fields).toHaveLength(18)
    expect(new Set(fields.map(f => f.type)).size).toBe(18)
  })
})
