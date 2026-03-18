import { describe, it, expect, vi } from 'vitest'
import { createAuthMiddleware } from '../auth/middleware.js'
import type { DbPool } from '@valencets/db'
import type { IncomingMessage, ServerResponse } from 'node:http'

function makeMockPool (returnValue: readonly Record<string, string | number | null>[] = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

function makeMockReq (cookie: string | undefined): IncomingMessage {
  return { headers: { cookie } } as IncomingMessage
}

function makeMockRes (): ServerResponse {
  const res = {
    writeHead: vi.fn(),
    end: vi.fn(),
    statusCode: 200
  }
  return res as unknown as ServerResponse
}

describe('createAuthMiddleware()', () => {
  it('calls next with user context when session is valid', async () => {
    const pool = makeMockPool([{ id: 'sess-1', user_id: 'user-1', expires_at: '2099-01-01T00:00:00Z' }])
    const middleware = createAuthMiddleware(pool)
    const req = makeMockReq('cms_session=sess-1')
    const res = makeMockRes()
    const next = vi.fn()
    await middleware(req, res, next)
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-1' }))
  })

  it('returns 401 when no session cookie', async () => {
    const pool = makeMockPool()
    const middleware = createAuthMiddleware(pool)
    const req = makeMockReq(undefined)
    const res = makeMockRes()
    const next = vi.fn()
    await middleware(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })

  it('returns 401 when session is invalid', async () => {
    const pool = makeMockPool([])
    const middleware = createAuthMiddleware(pool)
    const req = makeMockReq('cms_session=bad-session')
    const res = makeMockRes()
    const next = vi.fn()
    await middleware(req, res, next)
    expect(next).not.toHaveBeenCalled()
    expect(res.writeHead).toHaveBeenCalledWith(401, expect.any(Object))
  })
})
