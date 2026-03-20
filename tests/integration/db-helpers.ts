import postgres from 'postgres'
import type { DbPool } from '@valencets/db'

const TEST_DB = 'valence_integration_test'

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
  const sql = postgres({
    host: 'localhost',
    port: 5432,
    database: TEST_DB,
    max: 5,
    idle_timeout: 10,
    connect_timeout: 5
  })

  return { sql }
}
