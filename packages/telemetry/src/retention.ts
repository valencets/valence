// Data retention — cleanup old events and sessions

import { ResultAsync } from '@valencets/resultkit'
import { mapPostgresError } from '@valencets/db'
import type { DbError, DbPool } from '@valencets/db'

const DEFAULT_RETENTION_DAYS = 90

export function cleanupOldEvents (
  pool: DbPool,
  retentionDays: number = DEFAULT_RETENTION_DAYS
): ResultAsync<number, DbError> {
  return ResultAsync.fromPromise(
    pool.sql`
      DELETE FROM events
      WHERE created_at < NOW() - make_interval(days => ${retentionDays})
    `.then((result) => result.count),
    mapPostgresError
  )
}

export function cleanupOldSessions (
  pool: DbPool,
  retentionDays: number = DEFAULT_RETENTION_DAYS
): ResultAsync<number, DbError> {
  return ResultAsync.fromPromise(
    pool.sql`
      DELETE FROM sessions
      WHERE created_at < NOW() - make_interval(days => ${retentionDays})
        AND NOT EXISTS (
          SELECT 1 FROM events WHERE events.session_id = sessions.session_id
        )
    `.then((result) => result.count),
    mapPostgresError
  )
}
