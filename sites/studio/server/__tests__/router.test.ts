import { describe, it, expect, vi } from 'vitest'
import { createRouter, isFragmentRequest, sendHtml, sendJson, readBody } from '../router.js'
import type { RouteContext } from '../types.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

function mockReq (url: string, method: string = 'GET', headers: Record<string, string> = {}): IncomingMessage {
  return {
    url,
    method,
    headers: { host: 'localhost:3000', ...headers }
  } as unknown as IncomingMessage
}

function mockRes (): ServerResponse & { _body: string; _status: number; _headers: Record<string, string> } {
  const res = {
    _body: '',
    _status: 200,
    _headers: {} as Record<string, string>,
    statusCode: 200,
    writeHead (status: number, headers?: Record<string, string | number>) {
      res._status = status
      if (headers) {
        for (const [k, v] of Object.entries(headers)) {
          res._headers[k] = String(v)
        }
      }
    },
    end (body?: string) {
      res._body = body ?? ''
    },
    setHeader (key: string, value: string) {
      res._headers[key] = value
    }
  }
  return res as unknown as ServerResponse & { _body: string; _status: number; _headers: Record<string, string> }
}

const mockCtx: RouteContext = {
  pool: { sql: vi.fn() as unknown } as RouteContext['pool'],
  config: {
    port: 3000,
    host: '0.0.0.0',
    db: { host: 'localhost', port: 5432, database: 'test', username: 'test', password: 'test', max: 10, idle_timeout: 20, connect_timeout: 10 },
    adminToken: 'test-token',
    contactEmail: 'test@test.com'
  }
}

describe('createRouter', () => {
  it('returns an object with register and handle', () => {
    const router = createRouter()
    expect(typeof router.register).toBe('function')
    expect(typeof router.handle).toBe('function')
  })

  it('routes GET request to registered handler', async () => {
    const router = createRouter()
    const handler = vi.fn(async (_req, res) => {
      sendHtml(res, '<h1>Home</h1>')
    })
    router.register('/', { GET: handler })

    const req = mockReq('/')
    const res = mockRes()
    await router.handle(req, res, mockCtx)

    expect(handler).toHaveBeenCalledOnce()
    expect(res._body).toBe('<h1>Home</h1>')
  })

  it('returns 404 for unregistered route', async () => {
    const router = createRouter()
    const req = mockReq('/nonexistent')
    const res = mockRes()
    await router.handle(req, res, mockCtx)

    expect(res._status).toBe(404)
  })

  it('returns 405 for wrong method', async () => {
    const router = createRouter()
    router.register('/only-get', { GET: vi.fn() })

    const req = mockReq('/only-get', 'POST')
    const res = mockRes()
    await router.handle(req, res, mockCtx)

    expect(res._status).toBe(405)
  })

  it('uses /404 handler when registered', async () => {
    const router = createRouter()
    const notFoundHandler = vi.fn(async (_req, res) => {
      sendHtml(res, '<h1>Not Found</h1>', 404)
    })
    router.register('/404', { GET: notFoundHandler })

    const req = mockReq('/nonexistent')
    const res = mockRes()
    await router.handle(req, res, mockCtx)

    expect(notFoundHandler).toHaveBeenCalledOnce()
    expect(res._status).toBe(404)
  })
})

describe('isFragmentRequest', () => {
  it('returns true when X-Inertia-Fragment header is "1"', () => {
    const req = mockReq('/', 'GET', { 'x-inertia-fragment': '1' })
    expect(isFragmentRequest(req)).toBe(true)
  })

  it('returns false when header is absent', () => {
    const req = mockReq('/')
    expect(isFragmentRequest(req)).toBe(false)
  })

  it('returns false when header has wrong value', () => {
    const req = mockReq('/', 'GET', { 'x-inertia-fragment': 'false' })
    expect(isFragmentRequest(req)).toBe(false)
  })
})

describe('sendHtml', () => {
  it('sets Content-Type to text/html', () => {
    const res = mockRes()
    sendHtml(res, '<p>hello</p>')
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8')
  })

  it('defaults to 200 status', () => {
    const res = mockRes()
    sendHtml(res, '<p>hello</p>')
    expect(res._status).toBe(200)
  })

  it('accepts custom status code', () => {
    const res = mockRes()
    sendHtml(res, '<p>error</p>', 500)
    expect(res._status).toBe(500)
  })
})

describe('sendJson', () => {
  it('sets Content-Type to application/json', () => {
    const res = mockRes()
    sendJson(res, { ok: true })
    expect(res._headers['Content-Type']).toBe('application/json; charset=utf-8')
  })

  it('serializes object to JSON', () => {
    const res = mockRes()
    sendJson(res, { ok: true })
    expect(res._body).toBe('{"ok":true}')
  })
})

describe('registerRoutes', () => {
  it('registers the /audit route', async () => {
    const { registerRoutes } = await import('../register-routes.js')
    const router = createRouter()
    registerRoutes(router)

    const req = mockReq('/audit')
    const res = mockRes()
    await router.handle(req, res, mockCtx)

    expect(res._status).not.toBe(404)
  })

  it('registers the /admin/hud route', async () => {
    const { registerRoutes } = await import('../register-routes.js')
    const router = createRouter()
    registerRoutes(router)

    const req = mockReq('/admin/hud')
    const res = mockRes()
    await router.handle(req, res, mockCtx)

    // 401 is expected without auth — but NOT 404
    expect(res._status).not.toBe(404)
  })
})

describe('readBody', () => {
  it('reads body from request stream', async () => {
    const { PassThrough } = await import('node:stream')
    const stream = new PassThrough()
    stream.end('{"data":"hello"}')
    const req = stream as unknown as IncomingMessage

    const body = await readBody(req)
    expect(body).toBe('{"data":"hello"}')
  })
})
