import type { CollectionConfig } from '../schema/collection.js'

const IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_-]*$/

const SYSTEM_COLUMNS = new Set([
  'id', 'created_at', 'updated_at', 'deleted_at'
])

export function isValidIdentifier (name: string): boolean {
  return IDENTIFIER_RE.test(name) && name.length <= 63
}

export function sanitizeIdentifier (name: string): string {
  if (!isValidIdentifier(name)) {
    return ''
  }
  return `"${name}"`
}

export function getValidFieldNames (collection: CollectionConfig): Set<string> {
  const names = new Set<string>(SYSTEM_COLUMNS)
  for (const f of collection.fields) {
    names.add(f.name)
  }
  if (collection.versions?.drafts) {
    names.add('_status')
    names.add('publish_at')
  }
  return names
}

export function isAllowedField (fieldName: string, allowedFields: Set<string>): boolean {
  return allowedFields.has(fieldName) && isValidIdentifier(fieldName)
}

export function sanitizeOptionValue (value: string): string {
  return value.replace(/'/g, "''")
}
