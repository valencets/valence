import type { ResultAsync } from 'neverthrow'
import type { CmsError } from '../schema/types.js'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import type { RestRouteEntry } from '../api/rest-api.js'
import type { DocumentData } from '../db/query-builder.js'
import { z } from 'zod'
import { sendJson, sendErrorJson, safeReadBody, safeJsonParse } from '../api/http-utils.js'
import { verifyPassword } from './password.js'
import { createRateLimiter } from './rate-limit.js'
import { parseCookie } from './cookie.js'
import { safeQuery } from '../db/safe-query.js'
import { createSession, validateSession, destroySession, destroyUserSessions, buildSessionCookie, buildExpiredSessionCookie } from './session.js'
import { sanitizeIdentifier, isValidIdentifier } from '../db/sql-sanitize.js'
import { isAuthEnabled } from './auth-config.js'

interface UserRow {
  readonly id: string
  readonly email: string
  readonly password_hash: string
}

const loginSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1)
})

export function resolveDisplayField (collections: CollectionRegistry): string {
  for (const col of collections.getAll()) {
    if (!isAuthEnabled(col)) continue
    const display = col.fields.find(
      f => f.type === 'text' && f.name !== 'email' && f.name !== 'password_hash'
    )
    return display?.name ?? 'email'
  }
  return 'email'
}

function queryUser (pool: DbPool, email: string, safeDisplayCol: string): ResultAsync<UserRow | null, CmsError> {
  return safeQuery<UserRow[]>(
    pool,
    `SELECT id, email, password_hash, ${safeDisplayCol} FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1`,
    [email]
  ).map(rows => rows[0] ?? null)
}

export function createAuthRoutes (
  pool: DbPool,
  collections: CollectionRegistry
): Map<string, RestRouteEntry> {
  const rawDisplayField = resolveDisplayField(collections)
  const displayField = isValidIdentifier(rawDisplayField) ? rawDisplayField : 'email'
  const safeDisplayCol = sanitizeIdentifier(displayField)
  const routes = new Map<string, RestRouteEntry>()
  const loginLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 900_000 })

  routes.set('/api/users/login', {
    POST: async (req, res) => {
      const bodyResult = await safeReadBody(req)
      if (bodyResult.isErr()) { sendErrorJson(res, bodyResult.error.message, 400); return }
      const parseResult = await safeJsonParse(bodyResult.value)
      if (parseResult.isErr()) { sendErrorJson(res, parseResult.error.message, 400); return }

      const validation = loginSchema.safeParse(parseResult.value)
      if (!validation.success) {
        const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')
        sendErrorJson(res, `Validation failed: ${issues}`, 400)
        return
      }

      const { email, password } = validation.data

      if (!loginLimiter.check(email)) {
        sendErrorJson(res, 'Too many login attempts', 429)
        return
      }

      const userResult = await queryUser(pool, email, safeDisplayCol)
      if (userResult.isErr()) { sendErrorJson(res, 'Login failed', 401); return }
      const user = userResult.value
      if (!user) { sendErrorJson(res, 'Invalid credentials', 401); return }

      const verifyResult = await verifyPassword(password, user.password_hash)
      if (verifyResult.isErr() || !verifyResult.value) {
        sendErrorJson(res, 'Invalid credentials', 401)
        return
      }

      loginLimiter.reset(email)
      await destroyUserSessions(user.id, pool)
      const sessionResult = await createSession(user.id, pool)
      if (sessionResult.isErr()) { sendErrorJson(res, 'Login failed', 500); return }

      const cookie = buildSessionCookie(sessionResult.value)
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': cookie
      })
      res.end(JSON.stringify({ user: { id: user.id, email: user.email, [displayField]: Reflect.get(user, displayField) as string | undefined ?? user.email } }))
    }
  })

  routes.set('/api/users/logout', {
    POST: async (req, res) => {
      const cookieHeader = req.headers.cookie ?? ''
      const sessionId = parseCookie(cookieHeader, 'cms_session')
      if (sessionId) {
        await destroySession(sessionId, pool)
      }
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': buildExpiredSessionCookie()
      })
      res.end(JSON.stringify({ message: 'Logged out' }))
    }
  })

  routes.set('/api/users/me', {
    GET: async (req, res) => {
      const cookieHeader = req.headers.cookie ?? ''
      const sessionId = parseCookie(cookieHeader, 'cms_session')
      if (!sessionId) { sendErrorJson(res, 'Unauthorized', 401); return }

      const sessionResult = await validateSession(sessionId, pool)
      if (sessionResult.isErr()) { sendErrorJson(res, 'Unauthorized', 401); return }

      const userId = sessionResult.value
      const userResult = await safeQuery<UserRow[]>(
        pool,
        `SELECT id, email, ${safeDisplayCol} FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [userId]
      ).map(rows => rows[0] ?? null)

      if (userResult.isErr() || !userResult.value) {
        sendErrorJson(res, 'User not found', 404)
        return
      }

      const user = userResult.value
      sendJson(res, { id: user.id, email: user.email, [displayField]: Reflect.get(user, displayField) as string | undefined ?? user.email } as DocumentData)
    }
  })

  return routes
}
