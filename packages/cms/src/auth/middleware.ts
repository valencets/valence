import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import { validateSession } from './session.js'

export interface AuthContext {
  readonly userId: string
  readonly sessionId: string
}

function parseCookie (cookieHeader: string, name: string): string | null {
  const match = cookieHeader.split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`))
  if (!match) return null
  return match.slice(name.length + 1)
}

export function createAuthMiddleware (pool: DbPool) {
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
