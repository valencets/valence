/**
 * Standalone server startup script for Lighthouse CI.
 * Mirrors the setup from global-setup.ts but as a runnable .mjs module.
 * Used by the `lighthouse` CI job to boot the test server before LHCI runs.
 */
import postgres from 'postgres'

const PORT = Number(process.env.LHCI_PORT ?? 3111)
const TEST_DB = 'valence_lhci_test'

async function main () {
  // Lazy imports — compiled output must exist (pnpm build must run first)
  const { createPool, closePool } = await import('@valencets/db')
  const { collection, field, hashPassword } = await import('@valencets/cms')
  const { createTestApp } = await import('../integration/test-app.js')

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

  // Provision fresh database
  const adminSql = postgres({
    host: process.env.PGHOST ?? 'localhost',
    port: Number(process.env.PGPORT ?? 5432),
    username: process.env.PGUSER ?? 'postgres',
    password: process.env.PGPASSWORD ?? '',
    database: 'postgres',
    max: 2
  })
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

  const hashResult = await hashPassword('admin123')
  if (hashResult.isErr()) throw new Error('Failed to hash password for LHCI seed')
  await pool.sql.unsafe(
    'INSERT INTO "users" ("email", "password_hash", "name", "role") VALUES ($1, $2, $3, $4)',
    ['admin@test.local', hashResult.value, 'LHCI Admin', 'admin']
  )

  await pool.sql.unsafe(
    'INSERT INTO "posts" ("title", "slug", "body", "published") VALUES ($1, $2, $3, $4)',
    ['Welcome Post', 'welcome-post', '<p>Hello from LHCI!</p>', true]
  )

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

  const app = createTestApp({
    pool,
    collections: [postsCollection, usersCollection],
    secret: 'lhci-test-secret'
  })

  await new Promise((resolve) => {
    app.server.listen(PORT, () => {
      console.log(`LHCI test server running on http://localhost:${PORT}`)
      resolve(undefined)
    })
  })

  // Keep alive — CI job sends SIGTERM to shut down
  process.on('SIGTERM', async () => {
    console.log('LHCI server shutting down...')
    await app.close()
    await closePool(pool)
    process.exit(0)
  })
}

main().catch((err) => {
  console.error('LHCI server failed to start:', err)
  process.exit(1)
})
