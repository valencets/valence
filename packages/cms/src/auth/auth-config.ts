import type { CollectionConfig } from '../schema/collection.js'

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
