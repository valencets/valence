import { execSync } from 'node:child_process'
import postgres from 'postgres'
import { createPool, closePool, loadMigrations, runMigrations } from '@valencets/db'
import type { DbPool } from '@valencets/db'
import { beforeAll, afterAll } from 'vitest'

const TEST_DB = 'valence_integration_test'
const CMS_MIGRATIONS_DIR = new URL('../../packages/cms/migrations', import.meta.url).pathname
const TELEMETRY_MIGRATIONS_DIR = new URL('../../packages/telemetry/migrations', import.meta.url).pathname

let pool: DbPool | undefined
let setupDone = false

function isPostgresRunning (): boolean {
  const result = execSync('pg_isready 2>&1 || true', { encoding: 'utf-8' })
  return result.includes('accepting connections')
}

async function createTestDatabase (): Promise<void> {
  if (!isPostgresRunning()) {
    throw new Error(
      'PostgreSQL is not running. Start it before running integration tests.\n' +
      'Or run with Testcontainers: TEST_USE_CONTAINERS=1 pnpm test:integration'
    )
  }

  const adminSql = postgres({ database: 'postgres', max: 2 })

  const existing = await adminSql`
    SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}
  `
  if (existing.length > 0) {
    await adminSql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
    `
    await adminSql.unsafe(`DROP DATABASE ${TEST_DB}`)
  }

  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB}`)
  await adminSql.unsafe(`ALTER DATABASE ${TEST_DB} SET timezone = 'UTC'`)
  await adminSql.end()
}

async function migrateTestDatabase (): Promise<void> {
  pool = createPool({
    host: 'localhost',
    port: 5432,
    database: TEST_DB,
    username: '',
    password: '',
    max: 10,
    idle_timeout: 10,
    connect_timeout: 5
  })

  // Run CMS migrations
  const cmsMigrations = await loadMigrations(CMS_MIGRATIONS_DIR)
  if (cmsMigrations.isOk()) {
    const runResult = await runMigrations(pool, cmsMigrations.value)
    if (runResult.isErr()) {
      throw new Error(`CMS migrations failed: ${runResult.error.message}`)
    }
  }

  // Run telemetry migrations
  const telemetryMigrations = await loadMigrations(TELEMETRY_MIGRATIONS_DIR)
  if (telemetryMigrations.isOk()) {
    const runResult = await runMigrations(pool, telemetryMigrations.value)
    if (runResult.isErr()) {
      throw new Error(`Telemetry migrations failed: ${runResult.error.message}`)
    }
  }
}

export function getTestPool (): DbPool {
  if (!pool) throw new Error('Test database not initialized. Is setup.ts running?')
  return pool
}

async function teardownTestDatabase (): Promise<void> {
  if (pool) {
    await closePool(pool)
    pool = undefined
  }

  const adminSql = postgres({ database: 'postgres', max: 2 })
  await adminSql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
  `
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await adminSql.end()
}

beforeAll(async () => {
  if (setupDone) return
  await createTestDatabase()
  await migrateTestDatabase()
  setupDone = true
}, 60_000)

afterAll(async () => {
  await teardownTestDatabase()
  setupDone = false
})
