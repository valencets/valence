import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { CollectionConfig } from '../schema/collection.js'
import { CmsErrorCode } from '../schema/types.js'
import { isValidIdentifier } from './sql-sanitize.js'
import type { CmsError } from '../schema/types.js'

const TEXT_FIELD_TYPES = new Set(['text', 'textarea', 'richtext', 'slug', 'email'])

function getSearchableFields (col: CollectionConfig): readonly string[] {
  const searchConfig = col.search
  if (searchConfig !== undefined && searchConfig.fields !== undefined && searchConfig.fields.length > 0) {
    return searchConfig.fields
  }
  return col.fields
    .filter(f => TEXT_FIELD_TYPES.has(f.type))
    .map(f => f.name)
}

function getLanguage (col: CollectionConfig): string {
  const searchConfig = col.search
  if (searchConfig !== undefined && searchConfig.language !== undefined) {
    return searchConfig.language
  }
  return 'english'
}

function buildTsvectorExpression (fields: readonly string[], language: string): string {
  const parts = fields.map(f =>
    `to_tsvector('${language}', COALESCE(NEW."${f}", ''))`
  )
  return parts.join(' || ')
}

export function generateSearchMigration (col: CollectionConfig): Result<string, CmsError> {
  const fields = getSearchableFields(col)
  for (const f of fields) {
    if (!isValidIdentifier(f)) {
      return err({
        code: CmsErrorCode.INVALID_INPUT,
        message: `Invalid search field name: "${f}"`
      })
    }
  }
  if (fields.length === 0) {
    return err({
      code: CmsErrorCode.INVALID_INPUT,
      message: `Collection "${col.slug}" has no searchable text fields`
    })
  }

  const slug = col.slug
  const language = getLanguage(col)
  const tsvectorExpr = buildTsvectorExpression(fields, language)
  const functionName = `${slug}_search_vector_update`
  const triggerName = `${slug}_search_vector_trigger`
  const indexName = `idx_${slug}_search_vector`

  const sql = [
    `-- Search vector migration for "${slug}"`,
    `ALTER TABLE "${slug}" ADD COLUMN IF NOT EXISTS search_vector TSVECTOR;`,
    '',
    `CREATE INDEX IF NOT EXISTS "${indexName}" ON "${slug}" USING GIN (search_vector);`,
    '',
    `CREATE OR REPLACE FUNCTION "${functionName}"() RETURNS trigger AS $$`,
    'BEGIN',
    `  NEW.search_vector := ${tsvectorExpr};`,
    '  RETURN NEW;',
    'END;',
    '$$ LANGUAGE plpgsql;',
    '',
    `DROP TRIGGER IF EXISTS "${triggerName}" ON "${slug}";`,
    `CREATE TRIGGER "${triggerName}"`,
    `  BEFORE INSERT OR UPDATE ON "${slug}"`,
    `  FOR EACH ROW EXECUTE FUNCTION "${functionName}"();`
  ].join('\n')

  return ok(sql)
}
