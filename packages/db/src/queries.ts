import { okAsync, errAsync, ResultAsync } from 'neverthrow'
import type postgres from 'postgres'
import { DbErrorCode } from './types.js'
import type { DbError, SessionRow, EventRow, InsertableSession, InsertableEvent } from './types.js'
import type { DbPool } from './connection.js'
import { mapPostgresError } from './connection.js'

export function createSession (pool: DbPool, session: InsertableSession): ResultAsync<SessionRow, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<SessionRow[]>`
      INSERT INTO sessions (referrer, device_type, operating_system)
      VALUES (${session.referrer}, ${session.device_type}, ${session.operating_system})
      RETURNING session_id, created_at, referrer, device_type, operating_system
    `,
    mapPostgresError
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) return errAsync({ code: DbErrorCode.NO_ROWS, message: 'INSERT returned no rows' })
    return okAsync(row)
  })
}

export function getSessionById (pool: DbPool, sessionId: string): ResultAsync<SessionRow, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<SessionRow[]>`
      SELECT session_id, created_at, referrer, device_type, operating_system
      FROM sessions
      WHERE session_id = ${sessionId}
    `,
    mapPostgresError
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) return errAsync({ code: DbErrorCode.NO_ROWS, message: `Session not found: ${sessionId}` })
    return okAsync(row)
  })
}

export function insertEvent (pool: DbPool, event: InsertableEvent): ResultAsync<EventRow, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<EventRow[]>`
      INSERT INTO events (session_id, event_category, dom_target, payload)
      VALUES (${event.session_id}, ${event.event_category}, ${event.dom_target}, ${pool.sql.json(event.payload as postgres.JSONValue)})
      RETURNING event_id, session_id, created_at, event_category, dom_target, payload
    `,
    mapPostgresError
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) return errAsync({ code: DbErrorCode.NO_ROWS, message: 'INSERT returned no rows' })
    return okAsync(row)
  })
}

export function insertEvents (pool: DbPool, events: ReadonlyArray<InsertableEvent>): ResultAsync<number, DbError> {
  if (events.length === 0) {
    return okAsync(0)
  }

  return ResultAsync.fromPromise(
    (async () => {
      const values = events.map((e) => ({
        session_id: e.session_id,
        event_category: e.event_category,
        dom_target: e.dom_target,
        payload: pool.sql.json(e.payload as postgres.JSONValue)
      }))
      const result = await pool.sql`
        INSERT INTO events ${pool.sql(values, 'session_id', 'event_category', 'dom_target', 'payload')}
      `
      return result.count
    })(),
    mapPostgresError
  )
}

export function getEventsBySession (pool: DbPool, sessionId: string): ResultAsync<ReadonlyArray<EventRow>, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<EventRow[]>`
      SELECT event_id, session_id, created_at, event_category, dom_target, payload
      FROM events
      WHERE session_id = ${sessionId}
      ORDER BY created_at ASC
    `,
    mapPostgresError
  ).map((rows) => rows as ReadonlyArray<EventRow>)
}

export function getEventsByTimeRange (pool: DbPool, start: Date, end: Date): ResultAsync<ReadonlyArray<EventRow>, DbError> {
  return ResultAsync.fromPromise(
    pool.sql<EventRow[]>`
      SELECT event_id, session_id, created_at, event_category, dom_target, payload
      FROM events
      WHERE created_at >= ${start} AND created_at <= ${end}
      ORDER BY created_at ASC
    `,
    mapPostgresError
  ).map((rows) => rows as ReadonlyArray<EventRow>)
}
