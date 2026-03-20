import { describe, it, expect, expectTypeOf } from 'vitest'
import { FieldType } from '../schema/field-types.js'
import type { BlocksFieldConfig, BlockDefinition, FieldConfig } from '../schema/field-types.js'
import type { InferFieldType } from '../schema/infer.js'
import { field } from '../schema/fields.js'
import { generateZodSchema, generatePartialSchema } from '../validation/zod-generator.js'
import { getColumnType } from '../db/column-map.js'
import { renderFieldInput } from '../admin/field-renderers.js'

describe('FieldType.BLOCKS', () => {
  it('exists and equals "blocks"', () => {
    expect(FieldType.BLOCKS).toBe('blocks')
  })
})

describe('field.blocks()', () => {
  it('returns config with type blocks', () => {
    const heroBlock: BlockDefinition = {
      slug: 'hero',
      fields: [
        { type: 'text', name: 'heading' },
        { type: 'text', name: 'subheading' }
      ]
    }
    const config = field.blocks({
      name: 'content',
      blocks: [heroBlock]
    })
    expect(config.type).toBe('blocks')
    expect(config.name).toBe('content')
  })

  it('includes blocks, minRows, maxRows properties', () => {
    const config = field.blocks({
      name: 'layout',
      blocks: [
        { slug: 'hero', fields: [{ type: 'text', name: 'heading' }] },
        { slug: 'cta', fields: [{ type: 'text', name: 'label' }] }
      ],
      minRows: 1,
      maxRows: 10
    })
    expect(config.blocks).toHaveLength(2)
    expect(config.minRows).toBe(1)
    expect(config.maxRows).toBe(10)
  })

  it('block definitions accept optional labels', () => {
    const config = field.blocks({
      name: 'content',
      blocks: [{
        slug: 'hero',
        fields: [{ type: 'text', name: 'heading' }],
        labels: { singular: 'Hero Section', plural: 'Hero Sections' }
      }]
    })
    const block = config.blocks[0]
    expect(block).toBeDefined()
    expect(block!.labels?.singular).toBe('Hero Section')
  })

  it('satisfies BlocksFieldConfig type', () => {
    const config: BlocksFieldConfig = field.blocks({
      name: 'content',
      blocks: [{ slug: 'hero', fields: [] }]
    })
    expect(config.type).toBe('blocks')
  })
})

describe('Zod validation for blocks field', () => {
  const blocksField: FieldConfig = {
    type: 'blocks',
    name: 'content',
    required: true,
    blocks: [
      {
        slug: 'hero',
        fields: [
          { type: 'text', name: 'heading' } as FieldConfig,
          { type: 'text', name: 'subheading' } as FieldConfig
        ]
      },
      {
        slug: 'cta',
        fields: [
          { type: 'text', name: 'label' } as FieldConfig,
          { type: 'url', name: 'href' } as FieldConfig
        ]
      }
    ]
  }

  it('validates an array of discriminated blocks', () => {
    const schema = generateZodSchema([blocksField])
    const result = schema.safeParse({
      content: [
        { blockType: 'hero', heading: 'Hello', subheading: 'World' },
        { blockType: 'cta', label: 'Click', href: 'https://example.com' }
      ]
    })
    expect(result.success).toBe(true)
  })

  it('each block must have blockType matching a defined slug', () => {
    const schema = generateZodSchema([blocksField])
    const result = schema.safeParse({
      content: [
        { blockType: 'hero', heading: 'Hello', subheading: 'World' }
      ]
    })
    expect(result.success).toBe(true)
  })

  it('validates per-block fields', () => {
    const schema = generateZodSchema([blocksField])
    const result = schema.safeParse({
      content: [
        { blockType: 'cta', label: 'Click', href: 'not-a-url' }
      ]
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid blockType', () => {
    const schema = generateZodSchema([blocksField])
    const result = schema.safeParse({
      content: [
        { blockType: 'unknown', foo: 'bar' }
      ]
    })
    expect(result.success).toBe(false)
  })

  it('enforces minRows', () => {
    const constrainedField: FieldConfig = {
      type: 'blocks',
      name: 'layout',
      required: true,
      blocks: [{ slug: 'hero', fields: [{ type: 'text', name: 'heading' } as FieldConfig] }],
      minRows: 2
    }
    const schema = generateZodSchema([constrainedField])
    const result = schema.safeParse({
      layout: [{ blockType: 'hero', heading: 'One' }]
    })
    expect(result.success).toBe(false)
  })

  it('enforces maxRows', () => {
    const constrainedField: FieldConfig = {
      type: 'blocks',
      name: 'layout',
      required: true,
      blocks: [{ slug: 'hero', fields: [{ type: 'text', name: 'heading' } as FieldConfig] }],
      maxRows: 1
    }
    const schema = generateZodSchema([constrainedField])
    const result = schema.safeParse({
      layout: [
        { blockType: 'hero', heading: 'One' },
        { blockType: 'hero', heading: 'Two' }
      ]
    })
    expect(result.success).toBe(false)
  })

  it('partial schema makes blocks optional', () => {
    const schema = generatePartialSchema([blocksField])
    const result = schema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('Column map for blocks field', () => {
  it('getColumnType returns JSONB for blocks field', () => {
    const blocksField: FieldConfig = {
      type: 'blocks',
      name: 'content',
      blocks: [{ slug: 'hero', fields: [{ type: 'text', name: 'heading' } as FieldConfig] }]
    }
    expect(getColumnType(blocksField)).toBe('JSONB')
  })
})

describe('Type inference for blocks field', () => {
  it('infers discriminated union array type from blocks config', () => {
    const blocksConfig = {
      type: 'blocks',
      name: 'content',
      blocks: [
        {
          slug: 'hero',
          fields: [{ type: 'text', name: 'heading' }]
        },
        {
          slug: 'cta',
          fields: [
            { type: 'text', name: 'label' },
            { type: 'url', name: 'href' }
          ]
        }
      ]
    } as const

    expect(blocksConfig.type).toBe('blocks')

    type Result = InferFieldType<typeof blocksConfig>
    expectTypeOf<Result>().toEqualTypeOf<Array<
      | { readonly blockType: 'hero' } & { heading: string }
      | { readonly blockType: 'cta' } & { label: string; href: string }
    >>()
  })
})

describe('Admin renderer for blocks field', () => {
  it('renders container with class blocks-field', () => {
    const f = field.blocks({
      name: 'content',
      blocks: [
        { slug: 'hero', fields: [field.text({ name: 'heading' })] },
        { slug: 'cta', fields: [field.text({ name: 'label' })] }
      ]
    })
    const html = renderFieldInput(f, '[]')
    expect(html).toContain('blocks-field')
  })

  it('renders hidden input with name and JSON value', () => {
    const f = field.blocks({
      name: 'content',
      blocks: [{ slug: 'hero', fields: [field.text({ name: 'heading' })] }]
    })
    const value = JSON.stringify([{ blockType: 'hero', heading: 'Hello' }])
    const html = renderFieldInput(f, value)
    expect(html).toContain('name="content"')
    expect(html).toContain('type="hidden"')
  })

  it('renders per-block fieldset with nested fields when value has blocks', () => {
    const f = field.blocks({
      name: 'content',
      blocks: [{ slug: 'hero', fields: [field.text({ name: 'heading' })] }]
    })
    const value = JSON.stringify([{ blockType: 'hero', heading: 'Hello' }])
    const html = renderFieldInput(f, value)
    expect(html).toContain('<fieldset')
    expect(html).toContain('heading')
  })

  it('renders block type select dropdown and add button', () => {
    const f = field.blocks({
      name: 'content',
      blocks: [
        { slug: 'hero', fields: [field.text({ name: 'heading' })] },
        { slug: 'cta', fields: [field.text({ name: 'label' })] }
      ]
    })
    const html = renderFieldInput(f, '[]')
    expect(html).toContain('<select')
    expect(html).toContain('hero')
    expect(html).toContain('cta')
    expect(html).toContain('Add block')
  })

  it('renders per-block remove button', () => {
    const f = field.blocks({
      name: 'content',
      blocks: [{ slug: 'hero', fields: [field.text({ name: 'heading' })] }]
    })
    const value = JSON.stringify([{ blockType: 'hero', heading: 'Hello' }])
    const html = renderFieldInput(f, value)
    expect(html).toContain('Remove')
  })
})
