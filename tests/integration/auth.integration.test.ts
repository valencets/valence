import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import supertest from 'supertest'
import { createPool, closePool } from '@valencets/db'
import type { DbPool } from '@valencets/db'
import { collection, field, hashPassword } from '@valencets/cms'
import { startTestApp } from './test-app.js'
import type { TestApp } from './test-app.js'
import { createAdminSql, getTestDbConfig } from './db-helpers.js'

const TEST_DB = 'valence_auth_integration_test'

const usersCollection = collection({
  slug: 'users',
  auth: true,
  timestamps: true,
  fields: [
    field.text({ name: 'name', required: true }),
    field.text({ name: 'role' })
  ]
})

let pool: DbPool
let app: TestApp
let request: supertest.Agent

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

beforeAll(async () => {
  const adminSql = createAdminSql()

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

  pool = createPool(getTestDbConfig(TEST_DB))

  await pool.sql.unsafe(INIT_SQL)

  app = await startTestApp({
    pool,
    collections: [usersCollection],
    secret: 'test-secret'
  })

  request = supertest.agent(app.server)
}, 30_000)

afterAll(async () => {
  await app.close()
  await closePool(pool)

  const adminSql = createAdminSql()
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

async function seedUser (email: string, password: string, name: string): Promise<string> {
  const hashResult = await hashPassword(password)
  if (hashResult.isErr()) throw new Error('Failed to hash password')
  const rows = await pool.sql.unsafe(
    'INSERT INTO "users" ("email", "password_hash", "name", "role") VALUES ($1, $2, $3, $4) RETURNING id',
    [email, hashResult.value, name, 'admin']
  )
  return (rows[0] as { id: string }).id
}

describe('Auth integration tests', () => {
  describe('POST /api/users/login', () => {
    it('returns 200 with user data and session cookie for valid credentials', async () => {
      await seedUser('alice@test.local', 'SecurePass123!', 'Alice')

      const res = await request
        .post('/api/users/login')
        .send({ email: 'alice@test.local', password: 'SecurePass123!' })
        .expect(200)

      expect(res.body).toMatchObject({
        user: {
          email: 'alice@test.local',
          name: 'Alice'
        }
      })
      expect(res.body.user.id).toBeDefined()

      const setCookie = res.headers['set-cookie']
      expect(setCookie).toBeDefined()
      expect(String(setCookie)).toContain('cms_session=')
    })

    it('returns 401 for wrong password', async () => {
      await seedUser('bob@test.local', 'CorrectPass!', 'Bob')

      const res = await request
        .post('/api/users/login')
        .send({ email: 'bob@test.local', password: 'WrongPass!' })
        .expect(401)

      expect(res.body).toMatchObject({ error: 'Invalid credentials' })
    })

    it('returns 401 for nonexistent user', async () => {
      const res = await request
        .post('/api/users/login')
        .send({ email: 'nobody@test.local', password: 'Whatever!' })
        .expect(401)

      expect(res.body).toMatchObject({ error: 'Invalid credentials' })
    })

    it('returns 400 for missing email', async () => {
      const res = await request
        .post('/api/users/login')
        .send({ password: 'Whatever!' })
        .expect(400)

      expect(res.body.error).toBeDefined()
    })

    it('returns 400 for missing password', async () => {
      const res = await request
        .post('/api/users/login')
        .send({ email: 'alice@test.local' })
        .expect(400)

      expect(res.body.error).toBeDefined()
    })
  })

  describe('POST /api/users/logout', () => {
    it('returns 200 and clears session cookie', async () => {
      await seedUser('carol@test.local', 'LogoutTest!', 'Carol')

      // Login first
      const loginRes = await request
        .post('/api/users/login')
        .send({ email: 'carol@test.local', password: 'LogoutTest!' })
        .expect(200)

      const sessionCookie = String(loginRes.headers['set-cookie'])

      // Logout
      const res = await request
        .post('/api/users/logout')
        .set('Cookie', sessionCookie)
        .expect(200)

      expect(res.body).toMatchObject({ message: 'Logged out' })

      const setCookie = String(res.headers['set-cookie'])
      expect(setCookie).toContain('Max-Age=0')
    })
  })

  describe('GET /api/users/me', () => {
    it('returns 200 with user data when authenticated', async () => {
      await seedUser('dave@test.local', 'MeTest!', 'Dave')

      // Login
      const loginRes = await request
        .post('/api/users/login')
        .send({ email: 'dave@test.local', password: 'MeTest!' })
        .expect(200)

      const sessionCookie = String(loginRes.headers['set-cookie'])

      // Get current user
      const res = await request
        .get('/api/users/me')
        .set('Cookie', sessionCookie)
        .expect(200)

      expect(res.body).toMatchObject({
        email: 'dave@test.local',
        name: 'Dave'
      })
    })

    it('returns 401 without session cookie', async () => {
      await request
        .get('/api/users/me')
        .expect(401)
    })

    it('returns 401 after logout', async () => {
      await seedUser('eve@test.local', 'SessionTest!', 'Eve')

      // Login
      const loginRes = await request
        .post('/api/users/login')
        .send({ email: 'eve@test.local', password: 'SessionTest!' })
        .expect(200)

      const sessionCookie = String(loginRes.headers['set-cookie'])

      // Logout
      await request
        .post('/api/users/logout')
        .set('Cookie', sessionCookie)
        .expect(200)

      // Try to access /me — should fail
      await supertest(app.server)
        .get('/api/users/me')
        .expect(401)
    })
  })
})
