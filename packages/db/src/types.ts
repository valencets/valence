export const DbErrorCode = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  QUERY_FAILED: 'QUERY_FAILED',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION'
} as const

export type DbErrorCode = typeof DbErrorCode[keyof typeof DbErrorCode]

export interface DbError {
  readonly code: DbErrorCode
  readonly message: string
}

export interface SessionRow {
  readonly session_id: string
  readonly created_at: Date
  readonly referrer: string | null
  readonly device_type: string
  readonly operating_system: string | null
}

export interface EventRow {
  readonly event_id: number
  readonly session_id: string
  readonly created_at: Date
  readonly event_category: string
  readonly dom_target: string | null
  readonly payload: Record<string, unknown>
}

export interface InsertableSession {
  readonly referrer: string | null
  readonly device_type: string
  readonly operating_system: string | null
}

export interface InsertableEvent {
  readonly session_id: string
  readonly event_category: string
  readonly dom_target: string | null
  readonly payload: Record<string, unknown>
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
}
