import { errAsync, okAsync } from 'neverthrow'
import type { ResultAsync } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import { safeQuery } from '../db/safe-query.js'
import { generateToken } from './token-utils.js'

export const SessionErrorCode = Object.freeze({
  INTERNAL: 'INTERNAL',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  SESSION_EXPIRED: 'SESSION_EXPIRED'
} as const)

export type SessionErrorCode = typeof SessionErrorCode[keyof typeof SessionErrorCode]

export interface SessionError {
  readonly code: SessionErrorCode
  readonly message: string
}

interface SessionRow {
  readonly id: string
  readonly user_id: string
  readonly expires_at: string
}

/** Default session lifetime in seconds (2 hours). */
const DEFAULT_SESSION_MAX_AGE = 7200

/**
 * Create a new custom session row in the given table for the given userId.
 * The session ID is generated client-side as a 32-byte random hex string.
 *
 * @param pool - database connection pool
 * @param tableName - the custom sessions table to insert into
 * @param userId - the user to associate with the session
 * @param maxAge - session lifetime in seconds (default 7200)
 */
export function createCustomSession (
  pool: DbPool,
  tableName: string,
  userId: string,
  maxAge = DEFAULT_SESSION_MAX_AGE
): ResultAsync<{ sessionId: string, expiresAt: Date }, SessionError> {
  const tokenResult = generateToken()
  if (tokenResult.isErr()) {
    return errAsync({
      code: SessionErrorCode.INTERNAL,
      message: tokenResult.error.message
    })
  }

  const sessionId = tokenResult.value
  const intervalSec = Math.max(60, Math.floor(maxAge))

  return safeQuery<SessionRow[]>(
    pool,
    `INSERT INTO ${tableName} (id, user_id, expires_at) VALUES ($1, $2, NOW() + make_interval(secs => $3)) RETURNING id, user_id, expires_at`,
    [sessionId, userId, intervalSec]
  ).mapErr((e): SessionError => ({
    code: SessionErrorCode.INTERNAL,
    message: e.message
  })).andThen((rows) => {
    const row = rows[0]
    if (!row) {
      return errAsync<{ sessionId: string, expiresAt: Date }, SessionError>({
        code: SessionErrorCode.INTERNAL,
        message: 'No session row returned after insert'
      })
    }
    return okAsync({ sessionId: row.id, expiresAt: new Date(row.expires_at) })
  })
}

/**
 * Validate a custom session by looking it up in the given table and checking
 * that it has not expired.
 *
 * @param pool - database connection pool
 * @param tableName - the custom sessions table to query
 * @param sessionId - the session ID to look up
 */
export function validateCustomSession (
  pool: DbPool,
  tableName: string,
  sessionId: string
): ResultAsync<{ userId: string }, SessionError> {
  return safeQuery<SessionRow[]>(
    pool,
    `SELECT id, user_id, expires_at FROM ${tableName} WHERE id = $1 AND expires_at > NOW()`,
    [sessionId]
  ).mapErr((e): SessionError => ({
    code: SessionErrorCode.INTERNAL,
    message: e.message
  })).andThen((rows) => {
    const row = rows[0]
    if (!row) {
      return errAsync<{ userId: string }, SessionError>({
        code: SessionErrorCode.SESSION_NOT_FOUND,
        message: 'Session not found or expired'
      })
    }
    return okAsync({ userId: row.user_id })
  })
}

/**
 * Destroy (hard-delete) a custom session row from the given table.
 *
 * @param pool - database connection pool
 * @param tableName - the custom sessions table to delete from
 * @param sessionId - the session ID to delete
 */
export function destroyCustomSession (
  pool: DbPool,
  tableName: string,
  sessionId: string
): ResultAsync<void, SessionError> {
  return safeQuery<SessionRow[]>(
    pool,
    `DELETE FROM ${tableName} WHERE id = $1`,
    [sessionId]
  ).map(() => undefined).mapErr((e): SessionError => ({
    code: SessionErrorCode.INTERNAL,
    message: e.message
  }))
}
