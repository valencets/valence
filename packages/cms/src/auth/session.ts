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

export function createSession (userId: string, pool: DbPool): ResultAsync<string, CmsError> {
  return safeQuery<SessionRow[]>(
    pool,
    'INSERT INTO cms_sessions (user_id, expires_at) VALUES ($1, NOW() + INTERVAL \'2 hours\') RETURNING id, user_id',
    [userId]
  ).andThen((rows) => {
    const row = rows[0]
    if (!row) {
      return errAsync({ code: CmsErrorCode.INTERNAL, message: 'No session returned' })
    }
    return okAsync(row.id)
  })
}

export function validateSession (sessionId: string, pool: DbPool): ResultAsync<string, CmsError> {
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

export function buildSessionCookie (sessionId: string, maxAgeSeconds: number = 7200): string {
  return `cms_session=${sessionId}; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=${maxAgeSeconds}`
}

export function buildExpiredSessionCookie (): string {
  return 'cms_session=; Path=/; HttpOnly; SameSite=Strict; Secure; Max-Age=0'
}

export function destroySession (sessionId: string, pool: DbPool): ResultAsync<void, CmsError> {
  return safeQuery<SessionRow[]>(
    pool,
    'UPDATE cms_sessions SET deleted_at = NOW() WHERE id = $1 RETURNING id',
    [sessionId]
  ).map(() => undefined)
}
