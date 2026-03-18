import { describe, it, expect } from 'vitest'
import { generateAlterTableSql } from '../db/migration-generator.js'
import type { FieldConfig } from '../schema/field-types.js'

describe('generateAlterTableSql()', () => {
  it('generates ADD COLUMN for new fields', () => {
    const added: readonly FieldConfig[] = [
      { type: 'text', name: 'subtitle' },
      { type: 'boolean', name: 'featured' }
    ]
    const sql = generateAlterTableSql('posts', { added, removed: [], changed: [] })
    expect(sql).toContain('ALTER TABLE "posts"')
    expect(sql).toContain('ADD COLUMN "subtitle" TEXT')
    expect(sql).toContain('ADD COLUMN "featured" BOOLEAN')
  })

  it('generates DROP COLUMN for removed fields', () => {
    const removed: readonly string[] = ['old_field', 'deprecated']
    const sql = generateAlterTableSql('posts', { added: [], removed, changed: [] })
    expect(sql).toContain('DROP COLUMN "old_field"')
    expect(sql).toContain('DROP COLUMN "deprecated"')
  })

  it('generates ALTER COLUMN TYPE for changed fields', () => {
    const changed: readonly FieldConfig[] = [
      { type: 'number', name: 'price', hasDecimals: true }
    ]
    const sql = generateAlterTableSql('posts', { added: [], removed: [], changed })
    expect(sql).toContain('ALTER COLUMN "price" TYPE NUMERIC')
  })

  it('returns empty string when no changes', () => {
    const sql = generateAlterTableSql('posts', { added: [], removed: [], changed: [] })
    expect(sql).toBe('')
  })

  it('combines add, remove, and change in one statement', () => {
    const added: readonly FieldConfig[] = [{ type: 'text', name: 'new_col' }]
    const removed: readonly string[] = ['old_col']
    const changed: readonly FieldConfig[] = [{ type: 'number', name: 'count' }]
    const sql = generateAlterTableSql('posts', { added, removed, changed })
    expect(sql).toContain('ADD COLUMN "new_col"')
    expect(sql).toContain('DROP COLUMN "old_col"')
    expect(sql).toContain('ALTER COLUMN "count"')
  })
})
