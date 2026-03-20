import { describe, it, expect } from 'vitest'
import { FieldType } from '../schema/field-types.js'
import type { BlocksFieldConfig, BlockDefinition } from '../schema/field-types.js'
import { field } from '../schema/fields.js'

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
