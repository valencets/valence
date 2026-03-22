import { errAsync, okAsync } from 'neverthrow'
import type { ResultAsync } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import { safeQuery } from '../db/safe-query.js'

interface SessionRow {
  readonly id: string
  readonly user_id: string
  readonly expires_at: string
}

/** Default session lifetime in seconds (2 hours). */
export const DEFAULT_SESSION_MAX_AGE = 7200

/**
 * Create a new session for the given user.
 * @param maxAgeSeconds — session lifetime in seconds (default 7200 = 2 hours)
 */
export function createSession (userId: string, pool: DbPool, maxAgeSeconds = DEFAULT_SESSION_MAX_AGE): ResultAsync<string, CmsError> {
  const intervalSec = Math.max(60, Math.floor(maxAgeSeconds))
  return safeQuery<SessionRow[]>(
    pool,
    'INSERT INTO cms_sessions (user_id, expires_at) VALUES ($1, NOW() + make_interval(secs => $2)) RETURNING id, user_id',
    [userId, intervalSec]
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) {
      return errAsync({ code: CmsErrorCode.INTERNAL, message: 'No session returned' })
    }
    return okAsync(row.id)
  })
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateSession (sessionId: string, pool: DbPool): ResultAsync<string, CmsError> {
  if (!UUID_RE.test(sessionId)) {
    return errAsync({ code: CmsErrorCode.NOT_FOUND, message: 'Invalid session ID format' })
  }
  return safeQuery<SessionRow[]>(
    pool,
    'SELECT id, user_id, expires_at FROM cms_sessions WHERE id = $1 AND expires_at > NOW() AND deleted_at IS NULL',
    [sessionId]
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) {
      return errAsync({ code: CmsErrorCode.NOT_FOUND, message: 'Session not found or expired' })
    }
    return okAsync(row.user_id)
  })
}

export function buildSessionCookie (sessionId: string, maxAgeSeconds = DEFAULT_SESSION_MAX_AGE, secure = true): string {
  const secureFlag = secure ? '; Secure' : ''
  return `cms_session=${sessionId}; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=${maxAgeSeconds}`
}

export function buildExpiredSessionCookie (secure = true): string {
  const secureFlag = secure ? '; Secure' : ''
  return `cms_session=; Path=/; HttpOnly; SameSite=Lax${secureFlag}; Max-Age=0`
}

export function destroyUserSessions (userId: string, pool: DbPool): ResultAsync<void, CmsError> {
  return safeQuery<SessionRow[]>(
    pool,
    'UPDATE cms_sessions SET deleted_at = NOW() WHERE user_id = $1 AND deleted_at IS NULL',
    [userId]
  ).map(() => undefined)
}

export function destroySession (sessionId: string, pool: DbPool): ResultAsync<void, CmsError> {
  return safeQuery<SessionRow[]>(
    pool,
    'UPDATE cms_sessions SET deleted_at = NOW() WHERE id = $1 RETURNING id',
    [sessionId]
  ).map(() => undefined)
}
