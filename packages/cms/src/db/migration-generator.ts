import type { CollectionConfig } from '../schema/collection.js'
import type { FieldConfig } from '../schema/field-types.js'
import { getColumnType, getColumnConstraints } from './column-map.js'
import { isValidIdentifier } from './sql-sanitize.js'

export interface MigrationOutput {
  readonly name: string
  readonly up: string
  readonly down: string
}

function assertIdentifier (name: string): void {
  if (!isValidIdentifier(name)) {
    throw new Error(`Invalid SQL identifier: ${name}`)
  }
}

function buildColumnDef (f: FieldConfig): string {
  assertIdentifier(f.name)
  const colType = getColumnType(f)
  const constraints = getColumnConstraints(f)
  const parts = [`"${f.name}" ${colType}`]
  if (constraints) parts.push(constraints)
  return parts.join(' ')
}

function buildForeignKeys (fields: readonly FieldConfig[]): string[] {
  const fks: string[] = []
  for (const f of fields) {
    if ((f.type === 'relation' || f.type === 'media') && 'relationTo' in f) {
      assertIdentifier(f.name)
      assertIdentifier(f.relationTo)
      fks.push(`  FOREIGN KEY ("${f.name}") REFERENCES "${f.relationTo}"("id")`)
    }
  }
  return fks
}

function buildIndexStatements (collection: CollectionConfig): string[] {
  assertIdentifier(collection.slug)
  const statements: string[] = []
  for (const f of collection.fields) {
    const needsIndex = f.index === true || f.type === 'relation' || f.type === 'media'
    if (needsIndex) {
      assertIdentifier(f.name)
      statements.push(
        `CREATE INDEX IF NOT EXISTS "idx_${collection.slug}_${f.name}" ON "${collection.slug}" ("${f.name}");`
      )
    }
  }
  return statements
}

export function generateCreateTableSql (collection: CollectionConfig): string {
  assertIdentifier(collection.slug)

  const columns: string[] = [
    '  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'
  ]

  for (const f of collection.fields) {
    columns.push(`  ${buildColumnDef(f)}`)
  }

  if (collection.timestamps) {
    columns.push('  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    columns.push('  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
  }

  columns.push('  "deleted_at" TIMESTAMPTZ')

  const fks = buildForeignKeys(collection.fields)
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

export interface SchemaChanges {
  readonly added: readonly FieldConfig[]
  readonly removed: readonly string[]
  readonly changed: readonly FieldConfig[]
}

export function generateAlterTableSql (slug: string, changes: SchemaChanges): string {
  assertIdentifier(slug)
  const statements: string[] = []

  for (const f of changes.added) {
    assertIdentifier(f.name)
    statements.push(`ADD COLUMN ${buildColumnDef(f)}`)
  }

  for (const name of changes.removed) {
    assertIdentifier(name)
    statements.push(`DROP COLUMN "${name}"`)
  }

  for (const f of changes.changed) {
    assertIdentifier(f.name)
    const colType = getColumnType(f)
    statements.push(`ALTER COLUMN "${f.name}" TYPE ${colType}`)
  }

  if (statements.length === 0) return ''
  return `ALTER TABLE "${slug}"\n  ${statements.join(',\n  ')};`
}

export function generateCreateTable (collection: CollectionConfig): MigrationOutput {
  assertIdentifier(collection.slug)
  const timestamp = Date.now()
  return {
    name: `${timestamp}_create_${collection.slug}`,
    up: generateCreateTableSql(collection),
    down: `DROP TABLE IF EXISTS "${collection.slug}" CASCADE;`
  }
}
