import postgres from 'postgres'
import type { Sql } from 'postgres'
import { ok, err, ResultAsync } from 'neverthrow'
import type { Result } from 'neverthrow'
import { z } from 'zod'
import { DbErrorCode } from './types.js'
import type { DbConfig, DbError } from './types.js'

export interface DbPool {
  readonly sql: Sql
}

const dbConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string(),
  password: z.string(),
  max: z.number().int().min(1),
  idle_timeout: z.number().min(0),
  connect_timeout: z.number().min(0)
})

export function validateDbConfig (config: unknown): Result<DbConfig, DbError> {
  const parsed = dbConfigSchema.safeParse(config)

  if (parsed.success) {
    return ok(parsed.data)
  }

  const issues = parsed.error.issues.map((issue) =>
    `${issue.path.join('.')}: ${issue.message}`
  )

  return err({
    code: DbErrorCode.INVALID_CONFIG,
    message: `Invalid database config: ${issues.join('; ')}`
  })
}

export function createPool (config: DbConfig): DbPool {
  const sql = postgres({
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    max: config.max,
    idle_timeout: config.idle_timeout,
    connect_timeout: config.connect_timeout
  })

  return { sql }
}

export function closePool (pool: DbPool): ResultAsync<void, DbError> {
  return ResultAsync.fromPromise(
    pool.sql.end(),
    (e: unknown): DbError => ({
      code: DbErrorCode.CONNECTION_FAILED,
      message: e instanceof Error ? e.message : 'Failed to close pool'
    })
  )
}

const PG_ERROR_MAP = new Map<string, DbErrorCode>([
  ['23503', DbErrorCode.CONSTRAINT_VIOLATION],
  ['23505', DbErrorCode.CONSTRAINT_VIOLATION],
  ['23514', DbErrorCode.CONSTRAINT_VIOLATION],
  ['42501', DbErrorCode.QUERY_FAILED]
])

export function mapPostgresError (e: unknown): DbError {
  if (e instanceof Error && 'code' in e && typeof e.code === 'string') {
    const mappedCode = PG_ERROR_MAP.get(e.code)
    return {
      code: mappedCode ?? DbErrorCode.QUERY_FAILED,
      message: e.message
    }
  }

  return {
    code: DbErrorCode.QUERY_FAILED,
    message: e instanceof Error ? e.message : 'Unknown database error'
  }
}
