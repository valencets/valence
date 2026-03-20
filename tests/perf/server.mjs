/**
 * Perf Test Server — VAL-176
 * Starts a minimal CMS HTTP server for k6 performance tests in CI.
 * Reads PostgreSQL connection from environment variables.
 *
 * Environment:
 *   PORT      — HTTP port (default: 3000)
 *   PGHOST    — PostgreSQL host (default: localhost)
 *   PGPORT    — PostgreSQL port (default: 5432)
 *   PGUSER    — PostgreSQL user (default: postgres)
 *   PGPASSWORD — PostgreSQL password (default: empty)
 *   PGDATABASE — PostgreSQL database (default: valence_perf_test)
 */

import { createServer } from 'node:http'
import postgres from 'postgres'
import { createPool } from '@valencets/db'
import { buildCms, collection, field } from '@valencets/cms'

const PORT = parseInt(process.env.PORT || '3000', 10)
const PGHOST = process.env.PGHOST || 'localhost'
const PGPORT = parseInt(process.env.PGPORT || '5432', 10)
const PGUSER = process.env.PGUSER || 'postgres'
const PGPASSWORD = process.env.PGPASSWORD || ''
const PGDATABASE = process.env.PGDATABASE || 'valence_perf_test'

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
`

const postsCollection = collection({
  slug: 'posts',
  timestamps: true,
  fields: [
    field.text({ name: 'title', required: true }),
    field.slug({ name: 'slug', required: true, unique: true, slugFrom: 'title' }),
    field.textarea({ name: 'body' }),
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

function matchRoute (pathname, routes) {
  const exact = routes.get(pathname)
  if (exact) return { entry: exact, params: {} }

  for (const [pattern, entry] of routes) {
    if (!pattern.includes(':')) continue
    const patternParts = pattern.split('/')
    const pathParts = pathname.split('/')
    if (patternParts.length !== pathParts.length) continue
    const params = {}
    let match = true
    for (let i = 0; i < patternParts.length; i++) {
      const pp = patternParts[i]
      const up = pathParts[i]
      if (pp.startsWith(':')) {
        params[pp.slice(1)] = up
      } else if (pp !== up) {
        match = false
        break
      }
    }
    if (match) return { entry, params }
  }
  return null
}

async function main () {
  // Ensure the database exists
  const adminSql = postgres({
    host: PGHOST,
    port: PGPORT,
    user: PGUSER,
    password: PGPASSWORD,
    database: 'postgres',
    max: 2
  })

  const existing = await adminSql`SELECT 1 FROM pg_database WHERE datname = ${PGDATABASE}`
  if (existing.length === 0) {
    await adminSql.unsafe(`CREATE DATABASE ${PGDATABASE}`)
    console.log(`Created database: ${PGDATABASE}`)
  }
  await adminSql.end()

  // Connect to the perf database
  const pool = createPool({
    host: PGHOST,
    port: PGPORT,
    database: PGDATABASE,
    username: PGUSER,
    password: PGPASSWORD,
    max: 20,
    idle_timeout: 30,
    connect_timeout: 10
  })

  await pool.sql.unsafe(INIT_SQL)
  console.log('Database schema initialized')

  // Build the CMS
  const cmsResult = buildCms({
    db: pool,
    secret: 'perf-test-secret-not-for-production',
    collections: [postsCollection, usersCollection]
  })

  if (cmsResult.isErr()) {
    console.error('CMS build failed:', cmsResult.error.message)
    process.exit(1)
  }

  const cms = cmsResult.value

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const method = (req.method ?? 'GET')

    // Health check at root
    if (url.pathname === '/' && method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }))
      return
    }

    const adminMatch = matchRoute(url.pathname, cms.adminRoutes)
    if (adminMatch) {
      const handler = adminMatch.entry[method]
      if (handler) {
        await handler(req, res, adminMatch.params)
        return
      }
    }

    const restMatch = matchRoute(url.pathname, cms.restRoutes)
    if (restMatch) {
      const handler = restMatch.entry[method]
      if (handler) {
        await handler(req, res, restMatch.params)
        return
      }
      res.writeHead(405, { 'Content-Type': 'text/plain' })
      res.end('Method not allowed')
      return
    }

    res.writeHead(404, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  server.listen(PORT, () => {
    console.log(`Perf test server running on http://localhost:${PORT}`)
    console.log(`Database: ${PGDATABASE} on ${PGHOST}:${PGPORT}`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down perf server...')
    server.close(() => {
      process.exit(0)
    })
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main().catch((err) => {
  console.error('Perf server startup error:', err)
  process.exit(1)
})
