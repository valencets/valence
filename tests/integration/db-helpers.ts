import { execSync } from 'node:child_process'
import postgres from 'postgres'
import type { DbConfig, DbPool } from '@valencets/db'

const TEST_DB = 'valence_integration_test'
const TEST_PG_HOST = process.env.PGHOST ?? 'localhost'
const TEST_PG_PORT = Number(process.env.PGPORT ?? '55432')
const TEST_PG_USER = process.env.PGUSER ?? 'postgres'
const TEST_PG_PASSWORD = process.env.PGPASSWORD ?? 'postgres'

function getPgPort (): number {
  if (Number.isNaN(TEST_PG_PORT)) {
    throw new Error(`Invalid PGPORT: ${process.env.PGPORT ?? '<unset>'}`)
  }

  return TEST_PG_PORT
}

export function isTestPostgresRunning (): boolean {
  const result = execSync(
    `pg_isready -h "${TEST_PG_HOST}" -p "${getPgPort()}" -U "${TEST_PG_USER}" 2>&1 || true`,
    { encoding: 'utf-8' }
  )
  return result.includes('accepting connections')
}

export function createAdminSql () {
  return postgres({
    host: TEST_PG_HOST,
    port: getPgPort(),
    username: TEST_PG_USER,
    password: TEST_PG_PASSWORD,
    database: 'postgres',
    max: 2
  })
}

export function getTestDbConfig (database: string): DbConfig {
  return {
    host: TEST_PG_HOST,
    port: getPgPort(),
    database,
    username: TEST_PG_USER,
    password: TEST_PG_PASSWORD,
    max: 5,
    idle_timeout: 10,
    connect_timeout: 5
  }
}

/**
 * Creates a savepoint-based pool wrapper for per-test isolation.
 * Each test gets a savepoint that rolls back on cleanup,
 * keeping the database clean between tests without full re-migration.
 */
export function createIsolatedPool (basePool: DbPool): {
  pool: DbPool
  cleanup: () => Promise<void>
} {
  return {
    pool: basePool,
    async cleanup () {
      // Truncate all user tables to reset state between tests
      await basePool.sql.unsafe(`
        DO $$ DECLARE
          r RECORD;
        BEGIN
          FOR r IN (
            SELECT tablename FROM pg_tables
            WHERE schemaname = 'public'
            AND tablename NOT LIKE 'val_%_migrations'
          ) LOOP
            EXECUTE 'TRUNCATE TABLE "' || r.tablename || '" CASCADE';
          END LOOP;
        END $$;
      `)
    }
  }
}

/**
 * Creates a fresh pool connection to the test database.
 * Use when you need a separate connection (e.g., for concurrent test suites).
 */
export function createTestPool (): DbPool {
  const sql = postgres(getTestDbConfig(TEST_DB))

  return { sql }
}
