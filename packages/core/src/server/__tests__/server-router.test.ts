import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { createServerRouter } from '../server-router.js'
import type { RouteHandler } from '../server-types.js'
import type { Middleware } from '../middleware-types.js'

function mockReq (url: string, method: string = 'GET'): IncomingMessage {
  return { url, method, headers: { host: 'localhost' } } as unknown as IncomingMessage
}

function mockRes (): ServerResponse & { _body: string; _status: number; _headers: Record<string, string> } {
  const res = {
    _body: '',
    _status: 0,
    _headers: {} as Record<string, string>,
    setHeader (name: string, value: string) {
      res._headers[name] = value
    },
    headersSent: false,
    writeHead (status: number, headers?: Record<string, string>) {
      res._status = status
      if (headers) Object.assign(res._headers, headers)
      res.headersSent = true
      return res
    },
    end (body?: string) {
      if (body) res._body = body
    }
  }
  return res as unknown as ServerResponse & { _body: string; _status: number; _headers: Record<string, string> }
}

describe('createServerRouter', () => {
  it('dispatches GET handler for registered route', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200)
      res.end('ok')
    })

    router.register('/hello', { GET: handler })
    const req = mockReq('/hello')
    const res = mockRes()
    await router.handle(req, res)

    expect(handler).toHaveBeenCalledOnce()
    expect(res._body).toBe('ok')
  })

  it('dispatches POST handler for registered route', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(201)
      res.end('created')
    })

    router.register('/submit', { POST: handler })
    const req = mockReq('/submit', 'POST')
    const res = mockRes()
    await router.handle(req, res)

    expect(handler).toHaveBeenCalledOnce()
    expect(res._body).toBe('created')
  })

  it('dispatches PATCH handler for registered route', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200)
      res.end('patched')
    })

    router.register('/items/1', { PATCH: handler })
    const req = mockReq('/items/1', 'PATCH')
    const res = mockRes()
    await router.handle(req, res)

    expect(handler).toHaveBeenCalledOnce()
    expect(res._body).toBe('patched')
  })

  it('dispatches DELETE handler for registered route', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200)
      res.end('deleted')
    })

    router.register('/items/1', { DELETE: handler })
    const req = mockReq('/items/1', 'DELETE')
    const res = mockRes()
    await router.handle(req, res)

    expect(handler).toHaveBeenCalledOnce()
    expect(res._body).toBe('deleted')
  })

  it('returns 404 for unknown route', async () => {
    const router = createServerRouter()
    const req = mockReq('/nope')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(404)
    expect(res._body).toContain('Not found')
  })

  it('returns 405 for wrong method', async () => {
    const router = createServerRouter()
    router.register('/only-get', { GET: async (_req, res) => { res.end('ok') } })

    const req = mockReq('/only-get', 'POST')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(405)
    expect(res._body).toContain('not allowed')
  })

  it('calls 404 fallback handler when registered', async () => {
    const router = createServerRouter()
    const fallback = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(404)
      res.end('custom 404')
    })

    router.register('/404', { GET: fallback })
    const req = mockReq('/missing')
    const res = mockRes()
    await router.handle(req, res)

    expect(fallback).toHaveBeenCalledOnce()
    expect(res._body).toBe('custom 404')
  })

  it('error boundary: handler that rejects returns 500, server stays alive', async () => {
    const router = createServerRouter()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    router.register('/boom', {
      GET: async () => {
        return Promise.reject(new Error('db connection lost'))
      }
    })

    const req = mockReq('/boom')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(500)
    expect(res._body).toContain('Internal server error')
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[server-router]'),
      expect.stringContaining('db connection lost')
    )

    consoleSpy.mockRestore()
  })

  it('error boundary: handler that throws sync returns 500, server stays alive', async () => {
    const router = createServerRouter()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    router.register('/crash', {
      GET: async () => {
        throw new Error('null reference')
      }
    })

    const req = mockReq('/crash')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(500)
    expect(res._body).toContain('Internal server error')

    consoleSpy.mockRestore()
  })

  it('does not send 500 if handler already sent headers', async () => {
    const router = createServerRouter()
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    router.register('/partial', {
      GET: async (_req, res) => {
        res.writeHead(200)
        throw new Error('mid-stream failure')
      }
    })

    const req = mockReq('/partial')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(200)
    expect(consoleSpy).toHaveBeenCalled()

    consoleSpy.mockRestore()
  })

  it('sets security headers on every response', async () => {
    const router = createServerRouter()
    router.register('/secure', {
      GET: async (_req, res) => {
        res.writeHead(200)
        res.end('ok')
      }
    })

    const req = mockReq('/secure')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._headers['X-Content-Type-Options']).toBe('nosniff')
    expect(res._headers['X-Frame-Options']).toBe('DENY')
    expect(res._headers['Content-Security-Policy']).toContain("default-src 'self'")
    expect(res._headers['Strict-Transport-Security']).toContain('max-age')
    expect(res._headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
  })

  it('sets security headers even on 404 responses', async () => {
    const router = createServerRouter()
    const req = mockReq('/nonexistent')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(404)
    expect(res._headers['X-Content-Type-Options']).toBe('nosniff')
    expect(res._headers['X-Frame-Options']).toBe('DENY')
  })

  it('includes CSP nonce in security headers', async () => {
    const router = createServerRouter()
    router.register('/with-nonce', {
      GET: async (_req, res) => {
        res.writeHead(200)
        res.end('ok')
      }
    })

    const req = mockReq('/with-nonce')
    const res = mockRes()
    await router.handle(req, res)

    const csp = res._headers['Content-Security-Policy']
    expect(csp).toMatch(/nonce-[A-Za-z0-9+/]+=*/)
  })

  it('includes COOP and CORP headers', async () => {
    const router = createServerRouter()
    router.register('/cross-origin', {
      GET: async (_req, res) => {
        res.writeHead(200)
        res.end('ok')
      }
    })

    const req = mockReq('/cross-origin')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._headers['Cross-Origin-Opener-Policy']).toBe('same-origin')
    expect(res._headers['Cross-Origin-Resource-Policy']).toBe('same-origin')
  })

  it('handler receives RequestContext with parsed url', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200)
      res.end('ok')
    })

    router.register('/test', { GET: handler })
    const req = mockReq('/test?q=1')
    const res = mockRes()
    await router.handle(req, res)

    const ctx = handler.mock.calls[0]![2]
    expect(ctx.url.pathname).toBe('/test')
    expect(ctx.url.searchParams.get('q')).toBe('1')
  })

  it('ctx.requestId is a valid UUID', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200)
      res.end('ok')
    })

    router.register('/test', { GET: handler })
    await router.handle(mockReq('/test'), mockRes())

    const ctx = handler.mock.calls[0]![2]
    expect(ctx.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('X-Request-Id response header is set', async () => {
    const router = createServerRouter()
    router.register('/test', { GET: async (_req, res) => { res.end('ok') } })

    const res = mockRes()
    await router.handle(mockReq('/test'), res)

    expect(res._headers['X-Request-Id']).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('param extraction: /users/:id populates ctx.params', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200)
      res.end('ok')
    })

    router.register('/users/:id', { GET: handler })
    await router.handle(mockReq('/users/42'), mockRes())

    const ctx = handler.mock.calls[0]![2]
    expect(ctx.params).toEqual({ id: '42' })
  })

  it('router.use(mw) — global middleware runs on every request', async () => {
    const router = createServerRouter()
    const order: string[] = []

    const mw: Middleware = async (_req, _res, _ctx, next) => {
      order.push('mw')
      await next()
    }

    router.use(mw)
    router.register('/a', { GET: async (_req, res) => { order.push('handler-a'); res.end('a') } })
    router.register('/b', { GET: async (_req, res) => { order.push('handler-b'); res.end('b') } })

    await router.handle(mockReq('/a'), mockRes())
    await router.handle(mockReq('/b'), mockRes())

    expect(order).toEqual(['mw', 'handler-a', 'mw', 'handler-b'])
  })

  it('multiple use() — FIFO order', async () => {
    const router = createServerRouter()
    const order: string[] = []

    router.use(async (_req, _res, _ctx, next) => { order.push('first'); await next() })
    router.use(async (_req, _res, _ctx, next) => { order.push('second'); await next() })
    router.register('/test', { GET: async (_req, res) => { order.push('handler'); res.end('ok') } })

    await router.handle(mockReq('/test'), mockRes())

    expect(order).toEqual(['first', 'second', 'handler'])
  })

  it('route-specific middleware via register options', async () => {
    const router = createServerRouter()
    const order: string[] = []

    const routeMw: Middleware = async (_req, _res, _ctx, next) => {
      order.push('route-mw')
      await next()
    }

    router.register('/guarded', { GET: async (_req, res) => { order.push('handler'); res.end('ok') } }, { middleware: [routeMw] })
    router.register('/open', { GET: async (_req, res) => { order.push('open-handler'); res.end('ok') } })

    await router.handle(mockReq('/guarded'), mockRes())
    await router.handle(mockReq('/open'), mockRes())

    expect(order).toEqual(['route-mw', 'handler', 'open-handler'])
  })

  it('route middleware runs after global middleware', async () => {
    const router = createServerRouter()
    const order: string[] = []

    router.use(async (_req, _res, _ctx, next) => { order.push('global'); await next() })

    const routeMw: Middleware = async (_req, _res, _ctx, next) => {
      order.push('route')
      await next()
    }

    router.register('/test', { GET: async (_req, res) => { order.push('handler'); res.end('ok') } }, { middleware: [routeMw] })
    await router.handle(mockReq('/test'), mockRes())

    expect(order).toEqual(['global', 'route', 'handler'])
  })

  it('router.onError(handler) receives error + ctx', async () => {
    const router = createServerRouter()
    const errorHandler = vi.fn(async (error: Error, _req: IncomingMessage, res: ServerResponse) => {
      res.writeHead(500)
      res.end(`custom: ${error.message}`)
    })

    router.onError(errorHandler)
    router.register('/boom', { GET: async () => { throw new Error('kaboom') } })

    const res = mockRes()
    await router.handle(mockReq('/boom'), res)

    expect(errorHandler).toHaveBeenCalledOnce()
    expect(res._body).toBe('custom: kaboom')
  })

  it('middleware short-circuit returns 401 without calling handler', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => { res.end('ok') })

    const authGuard: Middleware = async (_req, res) => {
      res.writeHead(401)
      res.end('Unauthorized')
    }

    router.use(authGuard)
    router.register('/secret', { GET: handler })

    const res = mockRes()
    await router.handle(mockReq('/secret'), res)

    expect(res._status).toBe(401)
    expect(res._body).toBe('Unauthorized')
    expect(handler).not.toHaveBeenCalled()
  })

  it('HEAD fallback uses GET handler when no explicit HEAD', async () => {
    const router = createServerRouter()
    const handler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('hello')
    })

    router.register('/page', { GET: handler })
    const req = mockReq('/page', 'HEAD')
    const res = mockRes()
    await router.handle(req, res)

    expect(handler).toHaveBeenCalledOnce()
    expect(res._status).toBe(200)
    expect(res._headers['Content-Type']).toBe('text/plain')
  })

  it('HEAD uses explicit HEAD handler when registered', async () => {
    const router = createServerRouter()
    const getHandler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200)
      res.end('get body')
    })
    const headHandler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200, { 'X-Custom': 'head' })
      res.end()
    })

    router.register('/page', { GET: getHandler, HEAD: headHandler })
    const req = mockReq('/page', 'HEAD')
    const res = mockRes()
    await router.handle(req, res)

    expect(headHandler).toHaveBeenCalledOnce()
    expect(getHandler).not.toHaveBeenCalled()
    expect(res._headers['X-Custom']).toBe('head')
  })

  it('HEAD returns 405 when route has no GET handler', async () => {
    const router = createServerRouter()
    router.register('/post-only', { POST: async (_req, res) => { res.end('ok') } })

    const req = mockReq('/post-only', 'HEAD')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(405)
  })

  it('OPTIONS auto-response lists available methods', async () => {
    const router = createServerRouter()
    router.register('/items', {
      GET: async (_req, res) => { res.end('list') },
      POST: async (_req, res) => { res.end('create') }
    })

    const req = mockReq('/items', 'OPTIONS')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(204)
    const allow = res._headers.Allow
    expect(allow).toContain('GET')
    expect(allow).toContain('POST')
    expect(allow).toContain('HEAD')
    expect(allow).toContain('OPTIONS')
  })

  it('OPTIONS uses explicit OPTIONS handler when registered', async () => {
    const router = createServerRouter()
    const optionsHandler = vi.fn<RouteHandler>(async (_req, res) => {
      res.writeHead(200, { 'X-Custom': 'options' })
      res.end()
    })

    router.register('/custom', { GET: async (_req, res) => { res.end('ok') }, OPTIONS: optionsHandler })
    const req = mockReq('/custom', 'OPTIONS')
    const res = mockRes()
    await router.handle(req, res)

    expect(optionsHandler).toHaveBeenCalledOnce()
    expect(res._headers['X-Custom']).toBe('options')
  })

  it('OPTIONS does not include HEAD when no GET handler', async () => {
    const router = createServerRouter()
    router.register('/post-only', {
      POST: async (_req, res) => { res.end('ok') }
    })

    const req = mockReq('/post-only', 'OPTIONS')
    const res = mockRes()
    await router.handle(req, res)

    expect(res._status).toBe(204)
    const allow = res._headers.Allow
    expect(allow).toContain('POST')
    expect(allow).toContain('OPTIONS')
    expect(allow).not.toContain('HEAD')
  })
})
