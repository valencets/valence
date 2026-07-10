import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { withRequestLogging } from '../request-log.js'
import { createLogger } from '../logger.js'

interface Line {
  readonly level: string
  readonly record: Record<string, unknown>
}

function capturingLogger (): { logger: ReturnType<typeof createLogger>, lines: Line[] } {
  const lines: Line[] = []
  const logger = createLogger({
    level: 'debug',
    now: () => '2026-07-10T00:00:00.000Z',
    sink: (level, line) => { lines.push({ level, record: JSON.parse(line) as Record<string, unknown> }) }
  })
  return { logger, lines }
}

function mockReq (url: string, method: string = 'GET'): IncomingMessage {
  return { url, method, headers: { host: 'localhost' } } as unknown as IncomingMessage
}

interface MockRes extends EventEmitter {
  statusCode: number
  headersSent: boolean
  writableEnded: boolean
  _headers: Record<string, string | number>
  _body: string
  setHeader: (name: string, value: string | number) => void
  getHeader: (name: string) => string | number | undefined
  writeHead: (status: number, headers?: Record<string, string | number>) => MockRes
  end: (body?: string) => void
}

function mockRes (): MockRes {
  const res = new EventEmitter() as MockRes
  res.statusCode = 200
  res.headersSent = false
  res.writableEnded = false
  res._headers = {}
  res._body = ''
  res.setHeader = (name, value) => { res._headers[name] = value }
  res.getHeader = (name) => res._headers[name]
  res.writeHead = (status, headers) => {
    res.statusCode = status
    res.headersSent = true
    if (headers) Object.assign(res._headers, headers)
    return res
  }
  res.end = (body) => {
    if (body) res._body = body
    res.writableEnded = true
    res.emit('finish')
  }
  return res
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

describe('withRequestLogging', () => {
  it('sets an X-Request-Id header for every request', async () => {
    const { logger } = capturingLogger()
    const wrapped = withRequestLogging(logger, async (_req, res) => {
      res.writeHead(200)
      res.end('ok')
    })
    const res = mockRes()
    await wrapped(mockReq('/'), res as unknown as ServerResponse)

    expect(String(res._headers['X-Request-Id'])).toMatch(UUID_RE)
  })

  it('logs one completion line on finish with method, path, status and duration', async () => {
    const { logger, lines } = capturingLogger()
    const wrapped = withRequestLogging(logger, async (_req, res) => {
      res.writeHead(201)
      res.end('created')
    })
    const res = mockRes()
    await wrapped(mockReq('/posts', 'POST'), res as unknown as ServerResponse)

    const completion = lines.find(l => l.record.msg === 'request')
    expect(completion).toBeDefined()
    expect(completion?.level).toBe('info')
    expect(completion?.record).toMatchObject({
      method: 'POST',
      path: '/posts',
      status: 201
    })
    expect(typeof completion?.record.durationMs).toBe('number')
    expect(completion?.record.durationMs as number).toBeGreaterThanOrEqual(0)
  })

  it('logs the request id that matches the response header', async () => {
    const { logger, lines } = capturingLogger()
    const wrapped = withRequestLogging(logger, async (_req, res) => { res.writeHead(200); res.end() })
    const res = mockRes()
    await wrapped(mockReq('/'), res as unknown as ServerResponse)

    const completion = lines.find(l => l.record.msg === 'request')
    expect(completion?.record.requestId).toBe(res._headers['X-Request-Id'])
  })

  it('strips the query string from the logged path', async () => {
    const { logger, lines } = capturingLogger()
    const wrapped = withRequestLogging(logger, async (_req, res) => { res.writeHead(200); res.end() })
    const res = mockRes()
    await wrapped(mockReq('/search?q=secret&page=2'), res as unknown as ServerResponse)

    expect(lines.find(l => l.record.msg === 'request')?.record.path).toBe('/search')
  })

  it('passes the original req and res through to the handler', async () => {
    const { logger } = capturingLogger()
    const handler = vi.fn(async (_req: IncomingMessage, res: ServerResponse) => { res.writeHead(200); res.end() })
    const wrapped = withRequestLogging(logger, handler)
    const req = mockReq('/')
    const res = mockRes()
    await wrapped(req, res as unknown as ServerResponse)

    expect(handler).toHaveBeenCalledOnce()
    expect(handler.mock.calls[0]?.[0]).toBe(req)
  })

  it('catches a rejecting handler, logs an error line, and sends 500', async () => {
    const { logger, lines } = capturingLogger()
    const wrapped = withRequestLogging(logger, async () => {
      return Promise.reject(new Error('boom'))
    })
    const res = mockRes()
    await wrapped(mockReq('/crash'), res as unknown as ServerResponse)

    const failure = lines.find(l => l.record.msg === 'request failed')
    expect(failure?.level).toBe('error')
    expect(failure?.record).toMatchObject({ method: 'GET', path: '/crash', error: 'boom' })
    expect(failure?.record.requestId).toMatch(UUID_RE)
    expect(res.statusCode).toBe(500)
    expect(res.writableEnded).toBe(true)
  })

  it('does not resend when the handler already sent headers before throwing', async () => {
    const { logger, lines } = capturingLogger()
    const wrapped = withRequestLogging(logger, async (_req, res) => {
      res.writeHead(200)
      return Promise.reject(new Error('late failure'))
    })
    const res = mockRes()
    const writeHeadSpy = vi.spyOn(res, 'writeHead')
    await wrapped(mockReq('/partial'), res as unknown as ServerResponse)

    // The handler's own writeHead(200) is the only one; no 500 overwrite.
    expect(writeHeadSpy).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
    expect(lines.some(l => l.record.msg === 'request failed')).toBe(true)
  })

  it('does not throw when the handler resolves normally', async () => {
    const { logger } = capturingLogger()
    const wrapped = withRequestLogging(logger, async (_req, res) => { res.writeHead(204); res.end() })
    const res = mockRes()
    await expect(wrapped(mockReq('/'), res as unknown as ServerResponse)).resolves.toBeUndefined()
  })
})
