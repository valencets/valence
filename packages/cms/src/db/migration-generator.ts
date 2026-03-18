import type { CollectionConfig } from '../schema/collection.js'
import type { FieldConfig } from '../schema/field-types.js'
import { getColumnType, getColumnConstraints } from './column-map.js'

export interface MigrationOutput {
  readonly name: string
  readonly up: string
  readonly down: string
}

function buildColumnDef (f: FieldConfig): string {
  const colType = getColumnType(f)
  const constraints = getColumnConstraints(f)
  const parts = [`"${f.name}" ${colType}`]
  if (constraints) parts.push(constraints)
  return parts.join(' ')
}

function buildForeignKeys (fields: readonly FieldConfig[], _tableName: string): string[] {
  const fks: string[] = []
  for (const f of fields) {
    if (f.type === 'relation' && 'relationTo' in f) {
      fks.push(`  FOREIGN KEY ("${f.name}") REFERENCES "${f.relationTo}"("id")`)
    }
    if (f.type === 'media' && 'relationTo' in f) {
      fks.push(`  FOREIGN KEY ("${f.name}") REFERENCES "${f.relationTo}"("id")`)
    }
  }
  return fks
}

function buildIndexStatements (collection: CollectionConfig): string[] {
  const statements: string[] = []
  for (const f of collection.fields) {
    const needsIndex = f.index === true || f.type === 'relation' || f.type === 'media'
    if (needsIndex) {
      statements.push(
        `CREATE INDEX IF NOT EXISTS "idx_${collection.slug}_${f.name}" ON "${collection.slug}" ("${f.name}");`
      )
    }
  }
  return statements
}

export function generateCreateTableSql (collection: CollectionConfig): string {
  const columns: string[] = [
    '  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'
  ]

  for (const f of collection.fields) {
    if (f.type === 'group') {
      columns.push(`  ${buildColumnDef(f)}`)
    } else {
      columns.push(`  ${buildColumnDef(f)}`)
    }
  }

  if (collection.timestamps) {
    columns.push('  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    columns.push('  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
  }

  columns.push('  "deleted_at" TIMESTAMPTZ')

  const fks = buildForeignKeys(collection.fields, collection.slug)
  const allEntries = [...columns, ...fks]

  const parts: string[] = [
    `CREATE TABLE IF NOT EXISTS "${collection.slug}" (\n${allEntries.join(',\n')}\n);`
  ]

  const indexes = buildIndexStatements(collection)
  if (indexes.length > 0) {
    parts.push('')
    parts.push(...indexes)
  }

  return parts.join('\n')
}

export function generateCreateTable (collection: CollectionConfig): MigrationOutput {
  const timestamp = Date.now()
  return {
    name: `${timestamp}_create_${collection.slug}`,
    up: generateCreateTableSql(collection),
    down: `DROP TABLE IF EXISTS "${collection.slug}" CASCADE;`
  }
}
