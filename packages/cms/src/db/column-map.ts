import type { FieldConfig } from '../schema/field-types.js'
import { sanitizeOptionValue, isValidIdentifier } from './sql-sanitize.js'

const TYPE_MAP: Record<string, string> = {
  text: 'TEXT',
  textarea: 'TEXT',
  richtext: 'TEXT',
  number: 'INTEGER',
  boolean: 'BOOLEAN',
  select: 'TEXT',
  date: 'TIMESTAMPTZ',
  slug: 'TEXT',
  media: 'UUID',
  relation: 'UUID',
  group: 'JSONB',
  email: 'TEXT',
  url: 'TEXT',
  password: 'TEXT',
  json: 'JSONB',
  color: 'TEXT',
  multiselect: 'JSONB',
  array: 'JSONB'
}

export function getColumnType (field: FieldConfig): string {
  if (field.type === 'number' && 'hasDecimals' in field && field.hasDecimals) {
    return 'NUMERIC'
  }
  return TYPE_MAP[field.type] ?? 'TEXT'
}

export function getColumnConstraints (field: FieldConfig): string {
  const parts: string[] = []

  if (field.required) {
    parts.push('NOT NULL')
  }

  if (field.unique) {
    parts.push('UNIQUE')
  }

  if (field.type === 'select' && 'options' in field && isValidIdentifier(field.name)) {
    const values = field.options.map(o => `'${sanitizeOptionValue(o.value)}'`).join(', ')
    parts.push(`CHECK ("${field.name}" IN (${values}))`)
  }

  return parts.join(' ')
}
