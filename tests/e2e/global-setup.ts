import postgres from 'postgres'
import { createPool, closePool } from '@valencets/db'
import { collection, field, hashPassword } from '@valencets/cms'
import { createTestApp } from '../integration/test-app.js'
import type { TestApp } from '../integration/test-app.js'

const TEST_DB = 'valence_e2e_test'
const E2E_PORT = 3111

const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS "posts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" TEXT NOT NULL,
  "slug" TEXT NOT NULL UNIQUE,
  "body" TEXT,
  "published" BOOLEAN DEFAULT false,
  "publishedAt" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "users" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'editor',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "cms_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "deleted_at" TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS "document_revisions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "collection_slug" TEXT NOT NULL,
  "document_id" UUID NOT NULL,
  "revision_number" INT NOT NULL,
  "data" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE("collection_slug", "document_id", "revision_number")
);
`

const postsCollection = collection({
  slug: 'posts',
  timestamps: true,
  fields: [
    field.text({ name: 'title', required: true }),
    field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
    field.richtext({ name: 'body' }),
    field.boolean({ name: 'published' }),
    field.date({ name: 'publishedAt' })
  ]
})

const usersCollection = collection({
  slug: 'users',
  auth: true,
  timestamps: true,
  fields: [
    field.text({ name: 'name', required: true }),
    field.text({ name: 'role' })
  ]
})

let app: TestApp | undefined

async function globalSetup (): Promise<() => Promise<void>> {
  // Create test database
  const adminSql = postgres({ host: process.env.PGHOST ?? 'localhost', port: Number(process.env.PGPORT ?? 5432), username: process.env.PGUSER ?? 'postgres', password: process.env.PGPASSWORD ?? '', database: 'postgres', max: 2 })
  const existing = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}`
  if (existing.length > 0) {
    await adminSql`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
    `
    await adminSql.unsafe(`DROP DATABASE ${TEST_DB}`)
  }
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB}`)
  await adminSql.end()

  // Create pool and initialize schema
  const pool = createPool({
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    database: TEST_DB,
    username: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? '',
    max: 10,
    idle_timeout: 30,
    connect_timeout: 5
  })
  await pool.sql.unsafe(INIT_SQL)

  // Seed admin user
  const hashResult = await hashPassword('admin123')
  if (hashResult.isErr()) throw new Error('Failed to hash password')
  await pool.sql.unsafe(
    'INSERT INTO "users" ("email", "password_hash", "name", "role") VALUES ($1, $2, $3, $4)',
    ['admin@test.local', hashResult.value, 'Test Admin', 'admin']
  )

  // Seed a sample post
  await pool.sql.unsafe(
    'INSERT INTO "posts" ("title", "slug", "body", "published") VALUES ($1, $2, $3, $4)',
    ['Welcome Post', 'welcome-post', '<p>Hello from E2E tests!</p>', true]
  )

  // Start the CMS server
  app = createTestApp({
    pool,
    collections: [postsCollection, usersCollection],
    secret: 'e2e-test-secret'
  })

  // Listen on fixed port for Playwright
  await new Promise<void>((resolve) => {
    app!.server.listen(E2E_PORT, () => {
      console.log(`E2E test server running on http://localhost:${E2E_PORT}`)
      resolve()
    })
  })

  // Return teardown function
  return async () => {
    console.log('Tearing down E2E test server...')
    if (app) await app.close()
    await closePool(pool)

    const teardownSql = postgres({ host: process.env.PGHOST ?? 'localhost', port: Number(process.env.PGPORT ?? 5432), username: process.env.PGUSER ?? 'postgres', password: process.env.PGPASSWORD ?? '', database: 'postgres', max: 2 })
    await teardownSql`
      SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
    `
    await teardownSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
    await teardownSql.end()
    console.log('E2E teardown complete.')
  }
}

export default globalSetup
