export const DbErrorCode = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  QUERY_FAILED: 'QUERY_FAILED',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  NO_ROWS: 'NO_ROWS',
  AUTH_FAILED: 'AUTH_FAILED',
  QUERY_TIMEOUT: 'QUERY_TIMEOUT',
  POOL_EXHAUSTED: 'POOL_EXHAUSTED',
  SERIALIZATION_FAILURE: 'SERIALIZATION_FAILURE'
} as const

export type DbErrorCode = typeof DbErrorCode[keyof typeof DbErrorCode]

export interface DbError {
  readonly code: DbErrorCode
  readonly message: string
}

export interface DbConfig {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly username: string
  readonly password: string
  readonly max: number
  readonly idle_timeout: number
  readonly connect_timeout: number
  readonly query_timeout?: number | undefined
}
