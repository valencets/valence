import { describe, it, expect, vi, beforeEach } from 'vitest'
import { okAsync } from 'neverthrow'
import { ok } from 'neverthrow'

let mockReadBody = vi.fn(() => Promise.resolve(''))

beforeEach(() => {
  vi.resetModules()
  mockReadBody = vi.fn(() => Promise.resolve(''))
  vi.doMock('../../../server/router.js', () => ({
    readBody: (...args: unknown[]) => mockReadBody(...args),
    sendJson: vi.fn((res: { end: (d: string) => void }, data: unknown) => {
      res.end(JSON.stringify(data))
    })
  }))
  vi.doMock('@inertia/ingestion', () => ({
    safeJsonParse: (raw: string) => {
      if (raw.length === 0) return ok(null)
      const parsed = JSON.parse(raw)
      return ok(parsed)
    }
  }))
})

function makeRequest (headers: Record<string, string> = {}): import('http').IncomingMessage {
  return { headers } as unknown as import('http').IncomingMessage
}

function makeResponse (): {
  res: import('http').ServerResponse
  headers: Record<string, string | string[]>
  body: unknown
  statusCode: number
} {
  const headers: Record<string, string | string[]> = {}
  const state = {
    headers,
    body: null as unknown,
    statusCode: 200
  }
  const res = {
    setHeader: (name: string, value: string | string[]) => { headers[name.toLowerCase()] = value },
    end: vi.fn((data: string) => { state.body = JSON.parse(data) }),
    writeHead: vi.fn((code: number) => { state.statusCode = code })
  } as unknown as import('http').ServerResponse
  return { res, ...state }
}

describe('sessionHandler', () => {
  it('sets a non-HttpOnly has_session cookie alongside session_id', async () => {
    const sessionRow = {
      session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      created_at: new Date(),
      referrer: null,
      device_type: 'desktop',
      operating_system: 'Linux'
    }
    vi.doMock('@inertia/db', () => ({
      createSession: vi.fn(() => okAsync(sessionRow))
    }))
    const { sessionHandler } = await import('../server/session-handler.js')

    const req = makeRequest({ 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)' })
    const { res, headers } = makeResponse()
    const ctx = { pool: {} }

    await sessionHandler(req, res, ctx as never)

    const setCookie = headers['set-cookie']
    expect(Array.isArray(setCookie)).toBe(true)
    const cookies = setCookie as string[]
    expect(cookies.some((c: string) => c.includes('session_id=') && c.includes('HttpOnly'))).toBe(true)
    expect(cookies.some((c: string) => c.includes('has_session=1') && !c.includes('HttpOnly'))).toBe(true)
  })

  it('skips session creation when session_id cookie already present', async () => {
    const createSessionFn = vi.fn()
    vi.doMock('@inertia/db', () => ({
      createSession: createSessionFn
    }))
    const { sessionHandler } = await import('../server/session-handler.js')

    const req = makeRequest({
      cookie: 'session_id=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee; has_session=1',
      'user-agent': 'Mozilla/5.0'
    })
    const { res } = makeResponse()
    const ctx = { pool: {} }

    await sessionHandler(req, res, ctx as never)

    expect(createSessionFn).not.toHaveBeenCalled()
  })

  it('uses referrer from request body when present', async () => {
    let capturedSession: Record<string, unknown> | null = null
    const sessionRow = {
      session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      created_at: new Date(),
      referrer: 'https://google.com',
      device_type: 'desktop',
      operating_system: 'Linux'
    }
    vi.doMock('@inertia/db', () => ({
      createSession: vi.fn((_pool: unknown, session: Record<string, unknown>) => {
        capturedSession = session
        return okAsync(sessionRow)
      })
    }))

    mockReadBody = vi.fn(() => Promise.resolve(JSON.stringify({ referrer: 'https://google.com' })))

    const { sessionHandler } = await import('../server/session-handler.js')

    const req = makeRequest({ 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)' })
    const { res } = makeResponse()
    const ctx = { pool: {} }

    await sessionHandler(req, res, ctx as never)

    expect(capturedSession).not.toBeNull()
    expect(capturedSession!.referrer).toBe('https://google.com')
  })

  it('falls back to null referrer when body is empty', async () => {
    let capturedSession: Record<string, unknown> | null = null
    const sessionRow = {
      session_id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
      created_at: new Date(),
      referrer: null,
      device_type: 'desktop',
      operating_system: 'Linux'
    }
    vi.doMock('@inertia/db', () => ({
      createSession: vi.fn((_pool: unknown, session: Record<string, unknown>) => {
        capturedSession = session
        return okAsync(sessionRow)
      })
    }))

    mockReadBody = vi.fn(() => Promise.resolve(''))

    const { sessionHandler } = await import('../server/session-handler.js')

    const req = makeRequest({ 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64)' })
    const { res } = makeResponse()
    const ctx = { pool: {} }

    await sessionHandler(req, res, ctx as never)

    expect(capturedSession).not.toBeNull()
    expect(capturedSession!.referrer).toBeNull()
  })
})
