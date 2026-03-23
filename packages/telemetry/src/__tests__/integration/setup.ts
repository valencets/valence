import { execSync } from 'node:child_process'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import postgres from 'postgres'
import { createPool, closePool } from '@valencets/db'
import { loadMigrations, runMigrations } from '@valencets/db'
import type { DbPool } from '@valencets/db'

const __dirname = dirname(fileURLToPath(import.meta.url))
const MIGRATIONS_DIR = join(__dirname, '..', '..', '..', 'migrations')
const TEST_DB = 'telemetry_test'
const TEST_PG_HOST = process.env.PGHOST ?? 'localhost'
const TEST_PG_PORT = Number(process.env.PGPORT ?? '55432')
const TEST_PG_USER = process.env.PGUSER ?? 'postgres'
const TEST_PG_PASSWORD = process.env.PGPASSWORD ?? 'postgres'

let appPool: DbPool | undefined
let superuserPool: DbPool | undefined
let setupPromise: Promise<void> | undefined
let refCount = 0

function isPostgresRunning (): boolean {
  const result = execSync(
    `pg_isready -h "${TEST_PG_HOST}" -p "${TEST_PG_PORT}" -U "${TEST_PG_USER}" 2>&1 || true`,
    { encoding: 'utf-8' }
  )
  return result.includes('accepting connections')
}

export function getAppPool (): DbPool {
  if (!appPool) throw new Error('setupTestDatabase() has not been called')
  return appPool
}

export function getSuperuserPool (): DbPool {
  if (!superuserPool) throw new Error('setupTestDatabase() has not been called')
  return superuserPool
}

async function doSetup (): Promise<void> {
  if (!isPostgresRunning()) {
    throw new Error('PostgreSQL is not running. Start it before running integration tests.')
  }

  const adminSql = postgres({
    host: TEST_PG_HOST,
    port: TEST_PG_PORT,
    username: TEST_PG_USER,
    password: TEST_PG_PASSWORD,
    database: 'postgres',
    max: 2
  })

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

  superuserPool = createPool({
    host: TEST_PG_HOST,
    port: TEST_PG_PORT,
    database: TEST_DB,
    username: TEST_PG_USER,
    password: TEST_PG_PASSWORD,
    max: 5,
    idle_timeout: 10,
    connect_timeout: 5
  })

  const migrationsResult = await loadMigrations(MIGRATIONS_DIR)
  if (migrationsResult.isErr()) {
    throw new Error(`Failed to load migrations: ${migrationsResult.error.message}`)
  }

  const runResult = await runMigrations(superuserPool, migrationsResult.value)
  if (runResult.isErr()) {
    throw new Error(`Failed to run migrations: ${runResult.error.message}`)
  }

  appPool = superuserPool
}

export async function setupTestDatabase (): Promise<void> {
  refCount++
  if (!setupPromise) {
    setupPromise = doSetup()
  }
  await setupPromise
}

export async function teardownTestDatabase (): Promise<void> {
  refCount--
  if (refCount > 0) return

  if (appPool) {
    await closePool(appPool)
    appPool = undefined
  }
  if (superuserPool && superuserPool !== appPool) {
    await closePool(superuserPool)
    superuserPool = undefined
  }

  const adminSql = postgres({
    host: TEST_PG_HOST,
    port: TEST_PG_PORT,
    username: TEST_PG_USER,
    password: TEST_PG_PASSWORD,
    database: 'postgres',
    max: 2
  })

  await adminSql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
  `
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await adminSql.end()

  setupPromise = undefined
}
