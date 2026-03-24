import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { CollectionConfig } from '../schema/collection.js'
import type { FieldConfig } from '../schema/field-types.js'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import { getColumnType, getColumnConstraints } from './column-map.js'
import { isValidIdentifier } from './sql-sanitize.js'
import { getUploadConfig } from '../media/media-config.js'
import { flattenFields } from '../schema/field-utils.js'

export interface MigrationOutput {
  readonly name: string
  readonly up: string
  readonly down: string
}

const SEARCHABLE_FIELD_TYPES = new Set(['text', 'textarea', 'richtext', 'slug', 'email'])

function checkIdentifier (name: string): CmsError | null {
  if (!isValidIdentifier(name)) {
    return { code: CmsErrorCode.INVALID_INPUT, message: `Invalid SQL identifier: ${name}` }
  }
  return null
}

function resolveColumnType (f: FieldConfig, hasLocalization: boolean): string {
  return hasLocalization && f.localized ? 'JSONB' : getColumnType(f)
}

function buildColumnDef (f: FieldConfig, hasLocalization: boolean): Result<string, CmsError> {
  const idErr = checkIdentifier(f.name)
  if (idErr) return err(idErr)
  const colType = resolveColumnType(f, hasLocalization)
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
  for (const f of flattenFields(collection.fields)) {
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

function getSearchableFieldNames (collection: CollectionConfig): readonly string[] {
  return flattenFields(collection.fields)
    .filter(f => SEARCHABLE_FIELD_TYPES.has(f.type))
    .map(f => f.name)
}

function buildTsvectorExpression (fields: readonly string[]): string {
  return fields
    .map(f => `to_tsvector('english', COALESCE(NEW."${f}", ''))`)
    .join(' || ')
}

function buildSearchStatements (collection: CollectionConfig): string[] {
  const slug = collection.slug
  const searchFields = getSearchableFieldNames(collection)
  if (searchFields.length === 0) return []

  const indexName = `${slug}_search_idx`
  const functionName = `${slug}_search_update`
  const triggerName = `${slug}_search_update`
  const tsvectorExpr = buildTsvectorExpression(searchFields)

  return [
    '',
    `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${slug}" USING GIN (search_vector);`,
    '',
    `CREATE OR REPLACE FUNCTION ${functionName}() RETURNS trigger AS $$`,
    'BEGIN',
    `  NEW.search_vector := ${tsvectorExpr};`,
    '  RETURN NEW;',
    'END;',
    '$$ LANGUAGE plpgsql;',
    '',
    `CREATE TRIGGER "${triggerName}"`,
    `  BEFORE INSERT OR UPDATE ON "${slug}"`,
    `  FOR EACH ROW EXECUTE FUNCTION ${functionName}();`
  ]
}

export function generateCreateTableSql (collection: CollectionConfig, hasLocalization?: boolean): string {
  const slugErr = checkIdentifier(collection.slug)
  if (slugErr) return `-- ERROR: ${slugErr.message}`

  const columns: string[] = [
    '  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid()'
  ]

  for (const f of flattenFields(collection.fields)) {
    const colResult = buildColumnDef(f, hasLocalization ?? false)
    if (colResult.isErr()) return `-- ERROR: ${colResult.error.message}`
    columns.push(`  ${colResult.value}`)
  }

  const uploadConfig = getUploadConfig(collection)
  if (uploadConfig !== null) {
    if (uploadConfig.focalPoint) {
      columns.push('  "focalX" NUMERIC DEFAULT 0.5')
      columns.push('  "focalY" NUMERIC DEFAULT 0.5')
    }
    if (uploadConfig.imageSizes && uploadConfig.imageSizes.length > 0) {
      columns.push('  "sizes" JSONB')
    }
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

  const searchFields = getSearchableFieldNames(collection)
  if (searchFields.length > 0) {
    columns.push('  "search_vector" TSVECTOR')
  }

  const fkResult = buildForeignKeys(flattenFields(collection.fields))
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

  const searchStatements = buildSearchStatements(collection)
  if (searchStatements.length > 0) {
    parts.push(...searchStatements)
  }

  return parts.join('\n')
}

export interface SchemaChanges {
  readonly added: readonly FieldConfig[]
  readonly removed: readonly string[]
  readonly changed: readonly FieldConfig[]
}

export function generateAlterTableSql (slug: string, changes: SchemaChanges, hasLocalization?: boolean): string {
  const slugErr = checkIdentifier(slug)
  if (slugErr) return `-- ERROR: ${slugErr.message}`
  const statements: string[] = []

  for (const f of changes.added) {
    const colResult = buildColumnDef(f, hasLocalization ?? false)
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
    const colType = resolveColumnType(f, hasLocalization ?? false)
    statements.push(`ALTER COLUMN "${f.name}" TYPE ${colType}`)
  }

  if (statements.length === 0) return ''
  return `ALTER TABLE "${slug}"\n  ${statements.join(',\n  ')};`
}

export function generateCreateTable (collection: CollectionConfig, hasLocalization?: boolean): Result<MigrationOutput, CmsError> {
  const slugErr = checkIdentifier(collection.slug)
  if (slugErr) return err(slugErr)
  const timestamp = Date.now()
  return ok({
    name: `${timestamp}_create_${collection.slug}`,
    up: generateCreateTableSql(collection, hasLocalization),
    down: `DROP TABLE IF EXISTS "${collection.slug}" CASCADE;`
  })
}
