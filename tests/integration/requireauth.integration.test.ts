import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import supertest from 'supertest'
import postgres from 'postgres'
import { createPool, closePool } from '@valencets/db'
import type { DbPool } from '@valencets/db'
import { collection, field, hashPassword } from '@valencets/cms'
import { startTestApp } from './test-app.js'
import type { TestApp } from './test-app.js'

const TEST_DB = 'valence_requireauth_integration_test'

const usersCollection = collection({
  slug: 'users',
  auth: true,
  timestamps: true,
  fields: [
    field.text({ name: 'name', required: true }),
    field.text({ name: 'role' })
  ]
})

const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
`

let pool: DbPool
let appWithAuth: TestApp
let appWithoutAuth: TestApp
let requestWithAuth: supertest.Agent
let requestWithoutAuth: supertest.Agent

beforeAll(async () => {
  const adminSql = postgres({ database: 'postgres', max: 2 })
  const existing = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${TEST_DB}`
  if (existing.length > 0) {
    await adminSql`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
    `
    await adminSql.unsafe(`DROP DATABASE ${TEST_DB}`)
  }
  await adminSql.unsafe(`CREATE DATABASE ${TEST_DB}`)
  await adminSql.end()

  pool = createPool({
    host: 'localhost',
    port: 5432,
    database: TEST_DB,
    username: '',
    password: '',
    max: 5,
    idle_timeout: 10,
    connect_timeout: 5
  })

  await pool.sql.unsafe(INIT_SQL)

  appWithAuth = await startTestApp({
    pool,
    collections: [usersCollection],
    secret: 'test-secret',
    requireAuth: true
  })
  requestWithAuth = supertest.agent(appWithAuth.server)

  appWithoutAuth = await startTestApp({
    pool,
    collections: [usersCollection],
    secret: 'test-secret',
    requireAuth: false
  })
  requestWithoutAuth = supertest.agent(appWithoutAuth.server)
}, 30_000)

afterAll(async () => {
  await appWithAuth.close()
  await appWithoutAuth.close()
  await closePool(pool)

  const adminSql = postgres({ database: 'postgres', max: 2 })
  await adminSql`
    SELECT pg_terminate_backend(pid)
    FROM pg_stat_activity
    WHERE datname = ${TEST_DB} AND pid <> pg_backend_pid()
  `
  await adminSql.unsafe(`DROP DATABASE IF EXISTS ${TEST_DB}`)
  await adminSql.end()
}, 15_000)

beforeEach(async () => {
  await pool.sql.unsafe('DELETE FROM "cms_sessions"')
  await pool.sql.unsafe('DELETE FROM "users"')
})

describe('requireAuth integration tests', () => {
  describe('when requireAuth is true', () => {
    it('GET /admin redirects to /admin/login without session', async () => {
      const res = await requestWithAuth
        .get('/admin')
        .redirects(0)
        .expect(302)

      expect(res.headers.location).toBe('/admin/login')
    })

    it('GET /admin serves dashboard when authenticated', async () => {
      const hashResult = await hashPassword('TestPass123!')
      if (hashResult.isErr()) throw new Error('hash failed')

      await pool.sql.unsafe(
        'INSERT INTO "users" ("email", "password_hash", "name", "role") VALUES ($1, $2, $3, $4)',
        ['admin@test.local', hashResult.value, 'Admin', 'admin']
      )

      // Login to get session
      const loginRes = await requestWithAuth
        .post('/api/users/login')
        .send({ email: 'admin@test.local', password: 'TestPass123!' })
        .expect(200)

      const sessionCookie = String(loginRes.headers['set-cookie'])

      // Access admin with session
      const res = await requestWithAuth
        .get('/admin')
        .set('Cookie', sessionCookie)
        .expect(200)

      expect(res.text).toContain('html')
    })
  })

  describe('when requireAuth is false', () => {
    it('GET /admin serves dashboard without session', async () => {
      const res = await requestWithoutAuth
        .get('/admin')
        .expect(200)

      expect(res.text).toContain('html')
    })
  })
})
