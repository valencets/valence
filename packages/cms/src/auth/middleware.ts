import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { Middleware } from '@valencets/core/server'
import { createAuthGuard } from '@valencets/core/server'
import type { AuthResult } from '@valencets/core/server'
import { validateSession } from './session.js'
import { parseCookie } from './cookie.js'
import { safeQuery } from '../db/safe-query.js'

export interface AuthContext {
  readonly userId: string
  readonly sessionId: string
}

export type AuthMiddleware = (req: IncomingMessage, res: ServerResponse, next: (ctx: AuthContext) => void) => Promise<void>

interface UserRow {
  readonly id: string
  readonly role: string
}

export function createAuthMiddleware (pool: DbPool): AuthMiddleware {
  return async (
    req: IncomingMessage,
    res: ServerResponse,
    next: (ctx: AuthContext) => void
  ): Promise<void> => {
    const cookieHeader = req.headers.cookie
    if (!cookieHeader) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    const sessionId = parseCookie(cookieHeader, 'cms_session')
    if (!sessionId) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    const result = await validateSession(sessionId, pool)
    if (result.isErr()) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized' }))
      return
    }

    next({ userId: result.value, sessionId })
  }
}

export function createCmsAuthValidator (pool: DbPool): (req: IncomingMessage) => Promise<AuthResult> {
  return async (req: IncomingMessage): Promise<AuthResult> => {
    const cookieHeader = req.headers.cookie
    if (!cookieHeader) return { authenticated: false }

    const sessionId = parseCookie(cookieHeader, 'cms_session')
    if (!sessionId) return { authenticated: false }

    const sessionResult = await validateSession(sessionId, pool)
    if (sessionResult.isErr()) return { authenticated: false }

    const userId = sessionResult.value
    const userResult = await safeQuery<UserRow[]>(
      pool,
      'SELECT id, role FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1',
      [userId]
    )

    if (userResult.isErr()) return { authenticated: false }
    const user = userResult.value[0]
    if (!user) return { authenticated: false }

    return {
      authenticated: true,
      user: { id: user.id, role: user.role ?? 'editor' }
    }
  }
}

export interface CmsAuthGuardOptions {
  readonly redirectTo?: string
  readonly role?: string
}

export function createCmsAuthGuard (pool: DbPool, options?: CmsAuthGuardOptions): Middleware {
  return createAuthGuard({
    validate: createCmsAuthValidator(pool),
    redirectTo: options?.redirectTo,
    role: options?.role
  })
}
