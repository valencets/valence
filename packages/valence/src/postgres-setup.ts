import { ResultAsync } from '@valencets/resultkit'
import type { DbConfig, DbPool } from '@valencets/db'
import { createPool as realCreatePool, closePool as realClosePool } from '@valencets/db'
import { hashPassword } from '@valencets/cms'
import type { DbConnectionAnswers } from './init-steps.js'

/**
 * CMS init must set postgres up properly, not just hope: a compose file so
 * the database can be stood up when absent, connectivity verified before
 * claiming success, and the admin user minted during init when the panel
 * is chosen.
 */

export interface SetupError {
  readonly code: 'CONNECTION_FAILED' | 'ADMIN_CREATE_FAILED'
  readonly message: string
}

/** postgres 16 wired to the exact answers init collected — `docker compose up -d` and go. */
export function generateDockerCompose (answers: DbConnectionAnswers): string {
  return `services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${answers.dbName}
      POSTGRES_USER: ${answers.dbUser}
      POSTGRES_PASSWORD: ${answers.dbPassword}
    ports:
      - "${answers.dbPort}:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${answers.dbUser}"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
`
}

interface VerifyDeps {
  readonly createPool: typeof realCreatePool
  readonly closePool: typeof realClosePool
}

const DEFAULT_DEPS: VerifyDeps = { createPool: realCreatePool, closePool: realClosePool }

/** SELECT 1 round-trip — success is earned, never assumed. */
export function verifyDatabaseConnection (
  config: DbConfig,
  deps: VerifyDeps = DEFAULT_DEPS
): ResultAsync<void, SetupError> {
  const pool = deps.createPool(config)
  return ResultAsync.fromPromise(
    pool.sql`SELECT 1 AS one`,
    (e): SetupError => ({
      code: 'CONNECTION_FAILED',
      message: e instanceof Error ? e.message : 'Could not reach the database'
    })
  )
    .map(() => undefined)
    .andThen((value) =>
      ResultAsync.fromPromise(
        Promise.resolve(deps.closePool(pool)).then(() => value, () => value),
        (): SetupError => ({ code: 'CONNECTION_FAILED', message: 'Failed to close verification pool' })
      )
    )
    .orElse((error) =>
      ResultAsync.fromPromise(
        Promise.resolve(deps.closePool(pool)).then(() => undefined, () => undefined),
        (): SetupError => error
      ).andThen(() => ResultAsync.fromPromise(Promise.reject(new Error(error.message)), (): SetupError => error))
    )
}

export interface AdminUserAnswers {
  readonly email: string
  readonly password: string
  readonly name: string
}

/**
 * Mint the admin during init so the panel is usable on first boot. The
 * password rides as an argon2id hash — plaintext never reaches SQL.
 * Parameterized insert; ON CONFLICT keeps re-runs idempotent.
 */
export function createAdminUser (pool: DbPool, answers: AdminUserAnswers): ResultAsync<void, SetupError> {
  return hashPassword(answers.password)
    .mapErr((e): SetupError => ({ code: 'ADMIN_CREATE_FAILED', message: e.message }))
    .andThen((hash) =>
      ResultAsync.fromPromise(
        pool.sql.unsafe(
          'INSERT INTO "users" ("id", "email", "password_hash", "name", "role") VALUES (gen_random_uuid(), $1, $2, $3, $4) ON CONFLICT ("email") DO NOTHING RETURNING "id"',
          [answers.email, hash, answers.name, 'admin']
        ),
        (e): SetupError => ({
          code: 'ADMIN_CREATE_FAILED',
          message: e instanceof Error ? e.message : 'Admin user insert failed'
        })
      ).map(() => undefined)
    )
}
