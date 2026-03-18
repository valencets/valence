import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { CollectionRegistry } from '../schema/registry.js'
import type { RestRouteEntry } from '../api/rest-api.js'
import { verifyPassword } from './password.js'
import { createRateLimiter } from './rate-limit.js'
import { safeQuery } from '../db/safe-query.js'
import { createSession, validateSession, destroySession, buildSessionCookie, buildExpiredSessionCookie } from './session.js'
import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'

interface UserRow {
  readonly id: string
  readonly email: string
  readonly password_hash: string
  readonly name: string
}

function sendJson (res: ServerResponse, data: Record<string, string | number | boolean | null>, statusCode: number = 200): void {
  const body = JSON.stringify(data)
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function sendErrorJson (res: ServerResponse, message: string, statusCode: number): void {
  const body = JSON.stringify({ error: message })
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  })
  res.end(body)
}

function safeReadBody (req: IncomingMessage): ResultAsync<string, CmsError> {
  return ResultAsync.fromPromise(
    new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = []
      let received = 0
      req.on('data', (chunk: Buffer) => {
        received += chunk.length
        if (received > 1_048_576) {
          req.removeAllListeners('data')
          reject(new Error('Body too large'))
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')))
      req.on('error', (e: Error) => reject(e))
    }),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INVALID_INPUT,
      message: e instanceof Error ? e.message : 'Failed to read body'
    })
  )
}

function safeJsonParse<T> (body: string): ResultAsync<T, CmsError> {
  return ResultAsync.fromPromise(
    Promise.resolve().then(() => JSON.parse(body) as T),
    (): CmsError => ({
      code: CmsErrorCode.INVALID_INPUT,
      message: 'Invalid JSON'
    })
  )
}

function parseCookie (cookieHeader: string, name: string): string | null {
  const match = cookieHeader.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`))
  if (!match) return null
  return match.slice(name.length + 1)
}

function queryUser (pool: DbPool, email: string): ResultAsync<UserRow | null, CmsError> {
  return safeQuery<UserRow[]>(
    pool,
    'SELECT id, email, password_hash, name FROM users WHERE email = $1 AND deleted_at IS NULL LIMIT 1',
    [email]
  ).map(rows => rows[0] ?? null)
}

interface LoginBody {
  readonly email: string
  readonly password: string
}

export function createAuthRoutes (
  pool: DbPool,
  _collections: CollectionRegistry
): Map<string, RestRouteEntry> {
  const routes = new Map<string, RestRouteEntry>()
  const loginLimiter = createRateLimiter({ maxAttempts: 5, windowMs: 900_000 })

  routes.set('/api/users/login', {
    POST: async (req, res) => {
      const bodyResult = await safeReadBody(req)
      if (bodyResult.isErr()) { sendErrorJson(res, bodyResult.error.message, 400); return }
      const parseResult = await safeJsonParse<LoginBody>(bodyResult.value)
      if (parseResult.isErr()) { sendErrorJson(res, parseResult.error.message, 400); return }

      const { email, password } = parseResult.value
      if (!email || !password) { sendErrorJson(res, 'Email and password required', 400); return }

      if (!loginLimiter.check(email)) {
        sendErrorJson(res, 'Too many login attempts', 429)
        return
      }

      const userResult = await queryUser(pool, email)
      if (userResult.isErr()) { sendErrorJson(res, 'Login failed', 401); return }
      const user = userResult.value
      if (!user) { sendErrorJson(res, 'Invalid credentials', 401); return }

      const verifyResult = await verifyPassword(password, user.password_hash)
      if (verifyResult.isErr() || !verifyResult.value) {
        sendErrorJson(res, 'Invalid credentials', 401)
        return
      }

      loginLimiter.reset(email)
      const sessionResult = await createSession(user.id, pool)
      if (sessionResult.isErr()) { sendErrorJson(res, 'Login failed', 500); return }

      const cookie = buildSessionCookie(sessionResult.value)
      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8',
        'Set-Cookie': cookie
      })
      res.end(JSON.stringify({ user: { id: user.id, email: user.email, name: user.name } }))
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
      const userResult = await safeQuery<Array<{ id: string, email: string, name: string }>>(
        pool,
        'SELECT id, email, name FROM users WHERE id = $1 AND deleted_at IS NULL',
        [userId]
      ).map(rows => rows[0] ?? null)

      if (userResult.isErr() || !userResult.value) {
        sendErrorJson(res, 'User not found', 404)
        return
      }

      sendJson(res, userResult.value as Record<string, string | number | boolean | null>)
    }
  })

  return routes
}
