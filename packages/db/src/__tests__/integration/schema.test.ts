import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDatabase, teardownTestDatabase, getSuperuserPool } from './setup.js'
import type { DbPool } from '../../connection.js'

let pool: DbPool

beforeAll(async () => {
  await setupTestDatabase()
  pool = getSuperuserPool()
}, 30000)

afterAll(async () => {
  await teardownTestDatabase()
}, 10000)

describe('schema: tables', () => {
  it('sessions table exists', async () => {
    const rows = await pool.sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'sessions'
    `
    expect(rows.length).toBe(1)
  })

  it('events table exists', async () => {
    const rows = await pool.sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'events'
    `
    expect(rows.length).toBe(1)
  })

  it('_migrations table exists', async () => {
    const rows = await pool.sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = '_migrations'
    `
    expect(rows.length).toBe(1)
  })

  it('_migrations records both applied migrations', async () => {
    const rows = await pool.sql`
      SELECT version, name FROM _migrations ORDER BY version
    `
    expect(rows.length).toBe(2)
    expect(rows[0]!.version).toBe(1)
    expect(rows[0]!.name).toBe('init')
    expect(rows[1]!.version).toBe(2)
    expect(rows[1]!.name).toBe('rbac')
  })
})

describe('schema: column types', () => {
  it('session_id is UUID', async () => {
    const rows = await pool.sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'session_id'
    `
    expect(rows[0]!.data_type).toBe('uuid')
  })

  it('event_id is BIGSERIAL (bigint)', async () => {
    const rows = await pool.sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'event_id'
    `
    expect(rows[0]!.data_type).toBe('bigint')
  })

  it('created_at is TIMESTAMPTZ', async () => {
    const rows = await pool.sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'created_at'
    `
    expect(rows[0]!.data_type).toBe('timestamp with time zone')
  })

  it('event_category is VARCHAR(100)', async () => {
    const rows = await pool.sql`
      SELECT data_type, character_maximum_length FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'event_category'
    `
    expect(rows[0]!.data_type).toBe('character varying')
    expect(rows[0]!.character_maximum_length).toBe(100)
  })

  it('payload is JSONB', async () => {
    const rows = await pool.sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'payload'
    `
    expect(rows[0]!.data_type).toBe('jsonb')
  })

  it('sessions has no is_active column', async () => {
    const rows = await pool.sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'is_active'
    `
    expect(rows.length).toBe(0)
  })
})

describe('schema: constraints', () => {
  it('FK constraint: events.session_id references sessions', async () => {
    const rows = await pool.sql`
      SELECT constraint_name FROM information_schema.table_constraints
      WHERE table_name = 'events' AND constraint_type = 'FOREIGN KEY'
    `
    expect(rows.length).toBe(1)
  })

  it('ON DELETE RESTRICT prevents session deletion when events exist', async () => {
    const session = await pool.sql`
      INSERT INTO sessions (device_type) VALUES ('desktop')
      RETURNING session_id
    `
    const sessionId = session[0]!.session_id

    await pool.sql`
      INSERT INTO events (session_id, event_category)
      VALUES (${sessionId}, 'CLICK')
    `

    let errorCaught = false
    await pool.sql`DELETE FROM sessions WHERE session_id = ${sessionId}`
      .catch(() => { errorCaught = true })

    expect(errorCaught).toBe(true)

    // Cleanup: delete event first, then session
    await pool.sql`DELETE FROM events WHERE session_id = ${sessionId}`
    await pool.sql`DELETE FROM sessions WHERE session_id = ${sessionId}`
  })

  it('NOT NULL on device_type', async () => {
    const rows = await pool.sql`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'sessions' AND column_name = 'device_type'
    `
    expect(rows[0]!.is_nullable).toBe('NO')
  })

  it('NOT NULL on event_category', async () => {
    const rows = await pool.sql`
      SELECT is_nullable FROM information_schema.columns
      WHERE table_name = 'events' AND column_name = 'event_category'
    `
    expect(rows[0]!.is_nullable).toBe('NO')
  })

  it('default values work: uuid_generate_v4 and NOW()', async () => {
    const before = new Date()
    const rows = await pool.sql`
      INSERT INTO sessions (device_type) VALUES ('test')
      RETURNING session_id, created_at
    `
    const after = new Date()

    expect(rows[0]!.session_id).toBeTruthy()
    expect(rows[0]!.session_id.length).toBe(36) // UUID format
    expect(new Date(rows[0]!.created_at).getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(new Date(rows[0]!.created_at).getTime()).toBeLessThanOrEqual(after.getTime())

    // Cleanup
    await pool.sql`DELETE FROM sessions WHERE session_id = ${rows[0]!.session_id}`
  })

  it('default payload is empty JSON object', async () => {
    const session = await pool.sql`
      INSERT INTO sessions (device_type) VALUES ('test')
      RETURNING session_id
    `
    const rows = await pool.sql`
      INSERT INTO events (session_id, event_category)
      VALUES (${session[0]!.session_id}, 'TEST')
      RETURNING payload
    `
    expect(rows[0]!.payload).toEqual({})

    // Cleanup
    await pool.sql`DELETE FROM events WHERE session_id = ${session[0]!.session_id}`
    await pool.sql`DELETE FROM sessions WHERE session_id = ${session[0]!.session_id}`
  })
})

describe('schema: indexes', () => {
  it('idx_events_session exists', async () => {
    const rows = await pool.sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'events' AND indexname = 'idx_events_session'
    `
    expect(rows.length).toBe(1)
  })

  it('idx_events_time_category exists', async () => {
    const rows = await pool.sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'events' AND indexname = 'idx_events_time_category'
    `
    expect(rows.length).toBe(1)
  })

  it('idx_events_payload GIN index exists', async () => {
    const rows = await pool.sql`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'events' AND indexname = 'idx_events_payload'
    `
    expect(rows.length).toBe(1)
  })
})
