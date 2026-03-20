import { describe, it, expect } from 'vitest'
import { flattenFields } from '../schema/field-utils.js'
import { field } from '../schema/fields.js'
import type { FieldConfig } from '../schema/field-types.js'

describe('flattenFields()', () => {
  it('returns non-layout fields unchanged', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'title' }),
      field.number({ name: 'count' })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('title')
    expect(result[1]?.name).toBe('count')
  })

  it('flattens children of tabs field — excludes the tabs field itself', () => {
    const fields: readonly FieldConfig[] = [
      field.tabs({
        name: 'main_tabs',
        tabs: [
          { label: 'Content', fields: [field.text({ name: 'title' })] },
          { label: 'SEO', fields: [field.text({ name: 'metaTitle' })] }
        ]
      })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('title')
    expect(result[1]?.name).toBe('metaTitle')
    expect(result.some(f => f.type === 'tabs')).toBe(false)
  })

  it('flattens children of row field — excludes the row field itself', () => {
    const fields: readonly FieldConfig[] = [
      field.row({
        name: 'name_row',
        fields: [
          field.text({ name: 'firstName' }),
          field.text({ name: 'lastName' })
        ]
      })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('firstName')
    expect(result[1]?.name).toBe('lastName')
    expect(result.some(f => f.type === 'row')).toBe(false)
  })

  it('flattens children of collapsible field — excludes the collapsible field itself', () => {
    const fields: readonly FieldConfig[] = [
      field.collapsible({
        name: 'advanced',
        label: 'Advanced Settings',
        fields: [
          field.text({ name: 'notes' }),
          field.boolean({ name: 'isHidden' })
        ]
      })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('notes')
    expect(result[1]?.name).toBe('isHidden')
    expect(result.some(f => f.type === 'collapsible')).toBe(false)
  })

  it('flattens deeply nested tabs > row > collapsible', () => {
    const fields: readonly FieldConfig[] = [
      field.tabs({
        name: 'outer_tabs',
        tabs: [
          {
            label: 'Main',
            fields: [
              field.row({
                name: 'name_row',
                fields: [
                  field.collapsible({
                    name: 'extras',
                    label: 'Extra Settings',
                    fields: [
                      field.text({ name: 'deepField' })
                    ]
                  })
                ]
              }),
              field.text({ name: 'directField' })
            ]
          }
        ]
      })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(2)
    expect(result[0]?.name).toBe('deepField')
    expect(result[1]?.name).toBe('directField')
    expect(result.some(f => f.type === 'tabs')).toBe(false)
    expect(result.some(f => f.type === 'row')).toBe(false)
    expect(result.some(f => f.type === 'collapsible')).toBe(false)
  })

  it('handles mix of layout and non-layout fields', () => {
    const fields: readonly FieldConfig[] = [
      field.text({ name: 'beforeLayout' }),
      field.row({
        name: 'inline_row',
        fields: [
          field.text({ name: 'rowChild1' }),
          field.text({ name: 'rowChild2' })
        ]
      }),
      field.text({ name: 'afterLayout' })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(4)
    expect(result.map(f => f.name)).toEqual(['beforeLayout', 'rowChild1', 'rowChild2', 'afterLayout'])
  })

  it('handles empty tabs', () => {
    const fields: readonly FieldConfig[] = [
      field.tabs({ name: 't', tabs: [] })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(0)
  })

  it('handles tabs with empty tab entries', () => {
    const fields: readonly FieldConfig[] = [
      field.tabs({
        name: 't',
        tabs: [
          { label: 'Empty Tab', fields: [] }
        ]
      })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(0)
  })

  it('returns empty array for empty input', () => {
    const result = flattenFields([])
    expect(result).toHaveLength(0)
  })

  it('preserves group fields (groups create DB columns)', () => {
    const fields: readonly FieldConfig[] = [
      field.group({
        name: 'seo',
        fields: [field.text({ name: 'metaTitle' })]
      })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('group')
    expect(result[0]?.name).toBe('seo')
  })

  it('preserves blocks fields (blocks have their own storage)', () => {
    const fields: readonly FieldConfig[] = [
      field.blocks({
        name: 'content',
        blocks: [
          { slug: 'hero', fields: [field.text({ name: 'heading' })] }
        ]
      })
    ]
    const result = flattenFields(fields)
    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('blocks')
  })
})
