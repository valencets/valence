import { isValidIdentifier } from './sql-sanitize.js'

/**
 * Column name utilities for custom SQL queries against CMS-managed tables.
 *
 * CMS system columns use snake_case in the database:
 *   id, created_at, updated_at, deleted_at
 *
 * User-defined field names are stored as-is (matching the name in valence.config.ts).
 * If you define field.text({ name: 'avatarUrl' }), the column is "avatarUrl" (quoted).
 * If you define field.text({ name: 'avatar_url' }), the column is avatar_url.
 */

/** System columns present on every CMS-managed table. Always snake_case. */
export const SYSTEM_COLUMNS = {
  id: 'id',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at'
} as const

/** Convert a camelCase field name to its DB column name. System columns map to snake_case. */
export function toColumn (fieldName: string): string {
  if (fieldName in SYSTEM_COLUMNS) return SYSTEM_COLUMNS[fieldName as keyof typeof SYSTEM_COLUMNS]
  if (!isValidIdentifier(fieldName)) return fieldName
  return /[A-Z]/.test(fieldName) ? `"${fieldName}"` : fieldName
}

/**
 * Build a SELECT clause from field names, mapping system columns to snake_case.
 * @example selectColumns('id', 'username', 'createdAt') => 'id, username, created_at'
 */
export function selectColumns (...fields: string[]): string {
  return fields.map(toColumn).join(', ')
}
