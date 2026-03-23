import postgres from 'postgres'
import type { Sql } from 'postgres'
import { checkServerIdentity } from 'node:tls'
import { ok, err, ResultAsync } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { z } from 'zod'
import { DbErrorCode } from './types.js'
import type { DbConfig, DbError, DbSslMode } from './types.js'

export interface DbPool {
  readonly sql: Sql
}

const dbConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  max: z.number().int().min(1).max(100),
  idle_timeout: z.number().min(0).max(3_600_000),
  connect_timeout: z.number().min(0).max(60_000),
  query_timeout: z.number().min(0).max(600_000).optional(),
  sslmode: z.enum(['disable', 'require', 'verify-ca', 'verify-full']).optional(),
  sslrootcert: z.string().min(1).optional()
}).superRefine((config, ctx) => {
  if ((config.sslmode === 'verify-ca' || config.sslmode === 'verify-full') && config.sslrootcert === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sslrootcert'],
      message: `sslrootcert is required when sslmode is ${config.sslmode}`
    })
  }
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
  const sslmode = config.sslmode ?? 'disable'
  const base = {
    host: config.host,
    port: config.port,
    database: config.database,
    username: config.username,
    password: config.password,
    max: config.max,
    idle_timeout: config.idle_timeout,
    connect_timeout: config.connect_timeout,
    onnotice: () => {}
  }

  const ssl = createSslConfig(sslmode, config.sslrootcert)

  const sql = config.query_timeout !== undefined
    ? postgres({ ...base, ssl, connection: { statement_timeout: config.query_timeout } })
    : postgres({ ...base, ssl })

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
  ['23502', DbErrorCode.CONSTRAINT_VIOLATION],
  ['23503', DbErrorCode.CONSTRAINT_VIOLATION],
  ['23505', DbErrorCode.CONSTRAINT_VIOLATION],
  ['23514', DbErrorCode.CONSTRAINT_VIOLATION],
  ['28000', DbErrorCode.AUTH_FAILED],
  ['28P01', DbErrorCode.AUTH_FAILED],
  ['08000', DbErrorCode.CONNECTION_FAILED],
  ['08001', DbErrorCode.CONNECTION_FAILED],
  ['08003', DbErrorCode.CONNECTION_FAILED],
  ['08006', DbErrorCode.CONNECTION_FAILED],
  ['57014', DbErrorCode.QUERY_TIMEOUT],
  ['53300', DbErrorCode.POOL_EXHAUSTED],
  ['40001', DbErrorCode.SERIALIZATION_FAILURE],
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

const VERIFY_CA_CHECK_SERVER_IDENTITY = () => undefined

function createSslConfig (sslmode: DbSslMode, sslrootcert?: string): false | 'require' | {
  readonly ca: string
  readonly rejectUnauthorized: true
  readonly checkServerIdentity?: typeof checkServerIdentity | (() => undefined)
} {
  const sslConfigByMode = {
    disable: false,
    require: 'require',
    'verify-ca': {
      ca: sslrootcert ?? '',
      rejectUnauthorized: true as const,
      checkServerIdentity: VERIFY_CA_CHECK_SERVER_IDENTITY
    },
    'verify-full': {
      ca: sslrootcert ?? '',
      rejectUnauthorized: true as const
    }
  } satisfies Record<DbSslMode, false | 'require' | {
    readonly ca: string
    readonly rejectUnauthorized: true
    readonly checkServerIdentity?: typeof checkServerIdentity | (() => undefined)
  }>

  return sslConfigByMode[sslmode]
}
