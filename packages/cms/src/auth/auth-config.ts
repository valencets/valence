import type { CollectionConfig } from '../schema/collection.js'
import type { FieldConfig } from '../schema/field-types.js'

export interface AuthConfig {
  readonly tokenExpiration: number
  readonly maxLoginAttempts: number
  readonly lockTime: number
}

const AUTH_DEFAULTS: AuthConfig = {
  tokenExpiration: 7200,
  maxLoginAttempts: 5,
  lockTime: 600
}

export function isAuthEnabled (collection: CollectionConfig): boolean {
  return collection.auth === true
}

export function getAuthConfig (overrides: Partial<AuthConfig>): AuthConfig {
  return { ...AUTH_DEFAULTS, ...overrides }
}

export function getAuthFields (): readonly FieldConfig[] {
  return [
    { type: 'text', name: 'email', required: true, unique: true },
    { type: 'text', name: 'password_hash', required: true, hidden: true }
  ]
}

export function injectAuthFields (collection: CollectionConfig): CollectionConfig {
  if (!isAuthEnabled(collection)) return collection
  const existingNames = new Set(collection.fields.map(f => f.name))
  const authFields = getAuthFields().filter(f => !existingNames.has(f.name))
  return {
    ...collection,
    fields: [...collection.fields, ...authFields]
  }
}
