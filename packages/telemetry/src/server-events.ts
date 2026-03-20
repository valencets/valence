import { ResultAsync } from 'neverthrow'
import type { DbError, DbPool } from '@valencets/db'
import { createSession, insertEvent } from './event-queries.js'
import type { EventRow } from './event-types.js'

export interface ServerEventLogger {
  readonly log: (
    category: string,
    target: string,
    payload?: Record<string, string | number | boolean>
  ) => ResultAsync<EventRow, DbError>
}

/**
 * Creates a server-side event logger that records events to the telemetry database.
 * Each call to log() creates a new session (device_type: 'server', referrer: 'server')
 * and inserts a single event. Uses ResultAsync — no try/catch needed.
 */
export function createServerEventLogger (pool: DbPool): ServerEventLogger {
  return {
    log (category: string, target: string, payload: Record<string, string | number | boolean> = {}): ResultAsync<EventRow, DbError> {
      return createSession(pool, {
        device_type: 'server',
        referrer: 'server',
        operating_system: ''
      }).andThen((session) =>
        insertEvent(pool, {
          session_id: session.session_id,
          event_category: category,
          dom_target: target,
          payload
        })
      )
    }
  }
}
