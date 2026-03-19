import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDatabase, teardownTestDatabase, getAppPool, getSuperuserPool } from './setup.js'
import type { DbPool } from '../../connection.js'

let appPool: DbPool
let superPool: DbPool

beforeAll(async () => {
  await setupTestDatabase()
  appPool = getAppPool()
  superPool = getSuperuserPool()
}, 30000)

afterAll(async () => {
  await teardownTestDatabase()
}, 10000)

describe('RBAC: allowed operations', () => {
  it('app can INSERT into sessions', async () => {
    const rows = await appPool.sql`
      INSERT INTO sessions (device_type) VALUES ('desktop')
      RETURNING session_id
    `
    expect(rows.length).toBe(1)

    // Cleanup with superuser
    await superPool.sql`DELETE FROM sessions WHERE session_id = ${rows[0]!.session_id}`
  })

  it('app can SELECT from sessions', async () => {
    const rows = await appPool.sql`SELECT COUNT(*)::int as count FROM sessions`
    expect(rows[0]!.count).toBeGreaterThanOrEqual(0)
  })

  it('app can INSERT into events', async () => {
    const session = await superPool.sql`
      INSERT INTO sessions (device_type) VALUES ('test')
      RETURNING session_id
    `
    const rows = await appPool.sql`
      INSERT INTO events (session_id, event_category)
      VALUES (${session[0]!.session_id}, 'CLICK')
      RETURNING event_id
    `
    expect(rows.length).toBe(1)

    // Cleanup
    await superPool.sql`DELETE FROM events WHERE session_id = ${session[0]!.session_id}`
    await superPool.sql`DELETE FROM sessions WHERE session_id = ${session[0]!.session_id}`
  })

  it('app can SELECT from events', async () => {
    const rows = await appPool.sql`SELECT COUNT(*)::int as count FROM events`
    expect(rows[0]!.count).toBeGreaterThanOrEqual(0)
  })

  it('event_id auto-increment works via sequence grant', async () => {
    const session = await superPool.sql`
      INSERT INTO sessions (device_type) VALUES ('test')
      RETURNING session_id
    `
    const e1 = await appPool.sql`
      INSERT INTO events (session_id, event_category) VALUES (${session[0]!.session_id}, 'A')
      RETURNING event_id
    `
    const e2 = await appPool.sql`
      INSERT INTO events (session_id, event_category) VALUES (${session[0]!.session_id}, 'B')
      RETURNING event_id
    `
    expect(Number(e2[0]!.event_id)).toBeGreaterThan(Number(e1[0]!.event_id))

    // Cleanup
    await superPool.sql`DELETE FROM events WHERE session_id = ${session[0]!.session_id}`
    await superPool.sql`DELETE FROM sessions WHERE session_id = ${session[0]!.session_id}`
  })
})

describe('RBAC: denied operations', () => {
  it('app CANNOT UPDATE sessions', async () => {
    let errorCaught = false
    await appPool.sql`UPDATE sessions SET device_type = 'hacked' WHERE 1=0`
      .catch(() => { errorCaught = true })
    expect(errorCaught).toBe(true)
  })

  it('app CANNOT DELETE from sessions', async () => {
    let errorCaught = false
    await appPool.sql`DELETE FROM sessions WHERE 1=0`
      .catch(() => { errorCaught = true })
    expect(errorCaught).toBe(true)
  })

  it('app CANNOT TRUNCATE sessions', async () => {
    let errorCaught = false
    await appPool.sql`TRUNCATE sessions CASCADE`
      .catch(() => { errorCaught = true })
    expect(errorCaught).toBe(true)
  })

  it('app CANNOT UPDATE events', async () => {
    let errorCaught = false
    await appPool.sql`UPDATE events SET event_category = 'hacked' WHERE 1=0`
      .catch(() => { errorCaught = true })
    expect(errorCaught).toBe(true)
  })

  it('app CANNOT DELETE from events', async () => {
    let errorCaught = false
    await appPool.sql`DELETE FROM events WHERE 1=0`
      .catch(() => { errorCaught = true })
    expect(errorCaught).toBe(true)
  })
})
