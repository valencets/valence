import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { CollectionConfig } from '../schema/collection.js'
import type { FieldConfig } from '../schema/field-types.js'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import { getColumnType, getColumnConstraints } from './column-map.js'
import { isValidIdentifier } from './sql-sanitize.js'

export interface MigrationOutput {
  readonly name: string
  readonly up: string
  readonly down: string
}

function checkIdentifier (name: string): CmsError | null {
  if (!isValidIdentifier(name)) {
    return { code: CmsErrorCode.INVALID_INPUT, message: `Invalid SQL identifier: ${name}` }
  }
  return null
}

function buildColumnDef (f: FieldConfig): Result<string, CmsError> {
  const idErr = checkIdentifier(f.name)
  if (idErr) return err(idErr)
  const colType = getColumnType(f)
  const constraints = getColumnConstraints(f)
  const parts = [`"${f.name}" ${colType}`]
  if (constraints) parts.push(constraints)
  return ok(parts.join(' '))
}

function buildForeignKeys (fields: readonly FieldConfig[]): Result<string[], CmsError> {
  const fks: string[] = []
  for (const f of fields) {
    if ((f.type === 'relation' || f.type === 'media') && 'relationTo' in f) {
      const nameErr = checkIdentifier(f.name)
      if (nameErr) return err(nameErr)
      const relErr = checkIdentifier(f.relationTo)
      if (relErr) return err(relErr)
      fks.push(`  FOREIGN KEY ("${f.name}") REFERENCES "${f.relationTo}"("id")`)
    }
  }
  return ok(fks)
}

function buildIndexStatements (collection: CollectionConfig): Result<string[], CmsError> {
  const slugErr = checkIdentifier(collection.slug)
  if (slugErr) return err(slugErr)
  const statements: string[] = []
  for (const f of collection.fields) {
    const needsIndex = f.index === true || f.type === 'relation' || f.type === 'media'
    if (needsIndex) {
      const nameErr = checkIdentifier(f.name)
      if (nameErr) return err(nameErr)
      statements.push(
        `CREATE INDEX IF NOT EXISTS "idx_${collection.slug}_${f.name}" ON "${collection.slug}" ("${f.name}");`
      )
    }
  }
  return ok(statements)
}

export function generateCreateTableSql (collection: CollectionConfig): string {
  const slugErr = checkIdentifier(collection.slug)
  if (slugErr) return `-- ERROR: ${slugErr.message}`

  const columns: string[] = [
    '  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'
  ]

  for (const f of collection.fields) {
    const colResult = buildColumnDef(f)
    if (colResult.isErr()) return `-- ERROR: ${colResult.error.message}`
    columns.push(`  ${colResult.value}`)
  }

  if (collection.versions?.drafts) {
    columns.push('  "_status" TEXT NOT NULL DEFAULT \'draft\' CHECK ("_status" IN (\'draft\', \'published\'))')
    columns.push('  "publish_at" TIMESTAMPTZ')
  }

  if (collection.timestamps) {
    columns.push('  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
    columns.push('  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()')
  }

  columns.push('  "deleted_at" TIMESTAMPTZ')

  const fkResult = buildForeignKeys(collection.fields)
  if (fkResult.isErr()) return `-- ERROR: ${fkResult.error.message}`
  const allEntries = [...columns, ...fkResult.value]

  const parts: string[] = [
    `CREATE TABLE IF NOT EXISTS "${collection.slug}" (\n${allEntries.join(',\n')}\n);`
  ]

  const indexResult = buildIndexStatements(collection)
  if (indexResult.isErr()) return `-- ERROR: ${indexResult.error.message}`
  if (indexResult.value.length > 0) {
    parts.push('')
    parts.push(...indexResult.value)
  }

  return parts.join('\n')
}

export interface SchemaChanges {
  readonly added: readonly FieldConfig[]
  readonly removed: readonly string[]
  readonly changed: readonly FieldConfig[]
}

export function generateAlterTableSql (slug: string, changes: SchemaChanges): string {
  const slugErr = checkIdentifier(slug)
  if (slugErr) return `-- ERROR: ${slugErr.message}`
  const statements: string[] = []

  for (const f of changes.added) {
    const colResult = buildColumnDef(f)
    if (colResult.isErr()) return `-- ERROR: ${colResult.error.message}`
    statements.push(`ADD COLUMN ${colResult.value}`)
  }

  for (const name of changes.removed) {
    const nameErr = checkIdentifier(name)
    if (nameErr) return `-- ERROR: ${nameErr.message}`
    statements.push(`DROP COLUMN "${name}"`)
  }

  for (const f of changes.changed) {
    const nameErr = checkIdentifier(f.name)
    if (nameErr) return `-- ERROR: ${nameErr.message}`
    const colType = getColumnType(f)
    statements.push(`ALTER COLUMN "${f.name}" TYPE ${colType}`)
  }

  if (statements.length === 0) return ''
  return `ALTER TABLE "${slug}"\n  ${statements.join(',\n  ')};`
}

export function generateCreateTable (collection: CollectionConfig): Result<MigrationOutput, CmsError> {
  const slugErr = checkIdentifier(collection.slug)
  if (slugErr) return err(slugErr)
  const timestamp = Date.now()
  return ok({
    name: `${timestamp}_create_${collection.slug}`,
    up: generateCreateTableSql(collection),
    down: `DROP TABLE IF EXISTS "${collection.slug}" CASCADE;`
  })
}
