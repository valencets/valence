import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { createPool, closePool } from '@valencets/db'
import type { DbPool } from '@valencets/db'
import { createAdminSql, getTestDbConfig } from './db-helpers.js'

const TEST_DB = 'valence_telemetry_integration_test'

const INIT_SQL = `
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS "sessions" (
  "session_id" UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  "referrer" TEXT,
  "device_type" VARCHAR(50) NOT NULL DEFAULT 'desktop',
  "operating_system" TEXT,
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "events" (
  "event_id" BIGSERIAL PRIMARY KEY,
  "session_id" UUID NOT NULL REFERENCES "sessions"("session_id") ON DELETE RESTRICT,
  "event_category" VARCHAR(100) NOT NULL,
  "dom_target" TEXT,
  "payload" JSONB DEFAULT '{}',
  "created_at" TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS "daily_summaries" (
  "id" SERIAL PRIMARY KEY,
  "site_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "business_type" TEXT,
  "schema_version" INT DEFAULT 1,
  "session_count" INT,
  "pageview_count" INT,
  "conversion_count" INT,
  "top_referrers" JSONB DEFAULT '[]',
  "top_pages" JSONB DEFAULT '[]',
  "intent_counts" JSONB DEFAULT '{}',
  "avg_flush_ms" FLOAT DEFAULT 0,
  "rejection_count" INT DEFAULT 0,
  "synced_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("site_id", "date")
);
`

let pool: DbPool

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
}, 30_000)

afterAll(async () => {
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
  await pool.sql.unsafe('TRUNCATE TABLE "events", "daily_summaries", "sessions" CASCADE')
})

describe('Telemetry pipeline integration tests', () => {
  describe('sessions', () => {
    it('inserts a session and returns session_id', async () => {
      const rows = await pool.sql.unsafe(
        `INSERT INTO "sessions" ("referrer", "device_type", "operating_system")
         VALUES ($1, $2, $3)
         RETURNING "session_id"`,
        ['https://example.com', 'mobile', 'iOS']
      )

      expect(rows).toHaveLength(1)
      const row = rows[0] as { session_id: string }
      expect(row.session_id).toBeDefined()
      expect(typeof row.session_id).toBe('string')
    })

    it('uses default device_type when not specified', async () => {
      const rows = await pool.sql.unsafe(
        'INSERT INTO "sessions" ("referrer") VALUES ($1) RETURNING "session_id", "device_type"',
        ['https://example.com']
      )

      const row = rows[0] as { session_id: string; device_type: string }
      expect(row.device_type).toBe('desktop')
    })
  })

  describe('events', () => {
    it('inserts an event with a valid session_id', async () => {
      const sessionRows = await pool.sql.unsafe(
        'INSERT INTO "sessions" ("device_type") VALUES ($1) RETURNING "session_id"',
        ['desktop']
      )
      const { session_id: sessionId } = sessionRows[0] as { session_id: string }

      const eventRows = await pool.sql.unsafe(
        `INSERT INTO "events" ("session_id", "event_category", "dom_target", "payload")
         VALUES ($1, $2, $3, $4)
         RETURNING "event_id", "event_category"`,
        [sessionId, 'click', '#cta-button', JSON.stringify({ label: 'Buy now' })]
      )

      expect(eventRows).toHaveLength(1)
      const row = eventRows[0] as { event_id: number; event_category: string }
      expect(row.event_category).toBe('click')
      expect(row.event_id).toBeDefined()
    })

    it('rejects an event with an invalid session_id (foreign key violation)', async () => {
      const fakeSessionId = '00000000-0000-0000-0000-000000000000'

      await expect(
        pool.sql.unsafe(
          'INSERT INTO "events" ("session_id", "event_category") VALUES ($1, $2)',
          [fakeSessionId, 'pageview']
        )
      ).rejects.toThrow()
    })
  })

  describe('daily_summaries', () => {
    it('inserts a daily summary with correct fields', async () => {
      const rows = await pool.sql.unsafe(
        `INSERT INTO "daily_summaries"
           ("site_id", "date", "business_type", "session_count", "pageview_count", "conversion_count",
            "top_referrers", "top_pages", "intent_counts", "avg_flush_ms", "rejection_count")
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [
          'site-abc',
          '2026-03-19',
          'ecommerce',
          42,
          150,
          7,
          JSON.stringify([{ url: 'https://google.com', count: 30 }]),
          JSON.stringify([{ path: '/products', count: 80 }]),
          JSON.stringify({ purchase: 7, browse: 35 }),
          123.45,
          2
        ]
      )

      expect(rows).toHaveLength(1)
      const row = rows[0] as {
        site_id: string
        session_count: number
        pageview_count: number
        conversion_count: number
        avg_flush_ms: number
        rejection_count: number
        schema_version: number
      }
      expect(row.site_id).toBe('site-abc')
      expect(row.session_count).toBe(42)
      expect(row.pageview_count).toBe(150)
      expect(row.conversion_count).toBe(7)
      expect(row.avg_flush_ms).toBe(123.45)
      expect(row.rejection_count).toBe(2)
      expect(row.schema_version).toBe(1)
    })

    it('upserts a daily summary when site_id + date already exists', async () => {
      await pool.sql.unsafe(
        `INSERT INTO "daily_summaries" ("site_id", "date", "session_count", "pageview_count")
         VALUES ($1, $2, $3, $4)`,
        ['site-xyz', '2026-03-19', 10, 50]
      )

      await pool.sql.unsafe(
        `INSERT INTO "daily_summaries" ("site_id", "date", "session_count", "pageview_count")
         VALUES ($1, $2, $3, $4)
         ON CONFLICT ("site_id", "date") DO UPDATE
           SET "session_count" = EXCLUDED."session_count",
               "pageview_count" = EXCLUDED."pageview_count"`,
        ['site-xyz', '2026-03-19', 25, 120]
      )

      const rows = await pool.sql.unsafe(
        'SELECT * FROM "daily_summaries" WHERE "site_id" = $1 AND "date" = $2',
        ['site-xyz', '2026-03-19']
      )

      expect(rows).toHaveLength(1)
      const row = rows[0] as { session_count: number; pageview_count: number }
      expect(row.session_count).toBe(25)
      expect(row.pageview_count).toBe(120)
    })
  })

  describe('queries', () => {
    it('queries events by session_id', async () => {
      const sessionRows = await pool.sql.unsafe(
        'INSERT INTO "sessions" ("device_type") VALUES ($1) RETURNING "session_id"',
        ['desktop']
      )
      const { session_id: sessionId } = sessionRows[0] as { session_id: string }

      await pool.sql.unsafe(
        'INSERT INTO "events" ("session_id", "event_category") VALUES ($1, $2), ($1, $3)',
        [sessionId, 'pageview', 'click']
      )

      const rows = await pool.sql.unsafe(
        'SELECT * FROM "events" WHERE "session_id" = $1 ORDER BY "event_id"',
        [sessionId]
      )

      expect(rows).toHaveLength(2)
      const categories = (rows as Array<{ event_category: string }>).map(r => r.event_category)
      expect(categories).toEqual(['pageview', 'click'])
    })

    it('queries events by event_category', async () => {
      const sessionRows = await pool.sql.unsafe(
        'INSERT INTO "sessions" ("device_type") VALUES ($1) RETURNING "session_id"',
        ['mobile']
      )
      const { session_id: sessionId } = sessionRows[0] as { session_id: string }

      await pool.sql.unsafe(
        `INSERT INTO "events" ("session_id", "event_category")
         VALUES ($1, $2), ($1, $3), ($1, $2)`,
        [sessionId, 'pageview', 'click']
      )

      const rows = await pool.sql.unsafe(
        'SELECT * FROM "events" WHERE "event_category" = $1',
        ['pageview']
      )

      expect(rows).toHaveLength(2)
      const categories = (rows as Array<{ event_category: string }>).map(r => r.event_category)
      expect(categories.every(c => c === 'pageview')).toBe(true)
    })

    it('inserts multiple sessions and events with matching counts', async () => {
      await pool.sql.unsafe(
        'INSERT INTO "sessions" ("device_type") VALUES ($1), ($2), ($3)',
        ['desktop', 'mobile', 'tablet']
      )

      const allSessions = await pool.sql.unsafe('SELECT "session_id" FROM "sessions"')
      expect(allSessions).toHaveLength(3)

      const sessionIds = (allSessions as Array<{ session_id: string }>).map(r => r.session_id)

      for (const sid of sessionIds) {
        await pool.sql.unsafe(
          'INSERT INTO "events" ("session_id", "event_category") VALUES ($1, $2), ($1, $3)',
          [sid, 'pageview', 'scroll']
        )
      }

      const countRows = await pool.sql.unsafe('SELECT COUNT(*) AS total FROM "events"')
      const total = Number((countRows[0] as { total: string }).total)
      expect(total).toBe(6)
    })
  })
})
