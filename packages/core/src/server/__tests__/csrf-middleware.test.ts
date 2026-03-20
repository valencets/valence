import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext } from '../middleware-types.js'
import { createCsrfMiddleware } from '../csrf-middleware.js'

function stubCtx (): RequestContext {
  return {
    requestId: 'test-id',
    startTime: [0, 0] as readonly [number, number],
    url: new URL('http://localhost/'),
    params: {}
  }
}

function mockReq (method: string, headers: Record<string, string | undefined> = {}): IncomingMessage {
  return {
    method,
    headers,
    on: vi.fn()
  } as unknown as IncomingMessage
}

interface MockRes {
  statusCode: number
  _headers: Record<string, string>
  _body: string
  _ended: boolean
  setHeader: (name: string, value: string) => void
  getHeader: (name: string) => string | undefined
  writeHead: (statusCode: number, headers?: Record<string, string | number>) => void
  end: (body?: string) => void
}

function mockRes (): ServerResponse & MockRes {
  const mock = {
    statusCode: 200,
    _headers: {} as Record<string, string>,
    _body: '',
    _ended: false
  } as MockRes

  mock.setHeader = (name: string, value: string) => {
    mock._headers[name.toLowerCase()] = value
  }
  mock.getHeader = (name: string): string | undefined => {
    return mock._headers[name.toLowerCase()]
  }
  mock.writeHead = (statusCode: number, headers?: Record<string, string | number>) => {
    mock.statusCode = statusCode
    if (headers) {
      for (const [k, v] of Object.entries(headers)) {
        mock._headers[k.toLowerCase()] = String(v)
      }
    }
  }
  mock.end = (body?: string) => {
    mock._body = body ?? ''
    mock._ended = true
  }

  return mock as unknown as ServerResponse & MockRes
}

describe('createCsrfMiddleware', () => {
  const middleware = createCsrfMiddleware()

  it('sets __val_csrf cookie on GET responses when cookie absent', async () => {
    const req = mockReq('GET')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    const setCookie = (res as unknown as MockRes)._headers['set-cookie']
    expect(setCookie).toBeDefined()
    expect(setCookie).toContain('__val_csrf=')
    expect(setCookie).toContain('SameSite=Strict')
    expect(setCookie).toContain('Path=/')
    expect(next).toHaveBeenCalledOnce()
  })

  it('does NOT set cookie if already present', async () => {
    const req = mockReq('GET', { cookie: '__val_csrf=abc123' })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    const setCookie = (res as unknown as MockRes)._headers['set-cookie']
    expect(setCookie).toBeUndefined()
    expect(next).toHaveBeenCalledOnce()
  })

  it('skips validation for GET requests', async () => {
    const req = mockReq('GET')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('skips validation for HEAD requests', async () => {
    const req = mockReq('HEAD')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('skips validation for OPTIONS requests', async () => {
    const req = mockReq('OPTIONS')
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('validates POST: cookie value matches X-CSRF-Token header', async () => {
    const token = 'a'.repeat(64)
    const req = mockReq('POST', {
      cookie: '__val_csrf=' + token,
      'x-csrf-token': token
    })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('validates POST: cookie value matches _csrf body field', async () => {
    const token = 'b'.repeat(64)
    const req = mockReq('POST', {
      cookie: '__val_csrf=' + token,
      'content-type': 'application/x-www-form-urlencoded'
    })

    const bodyChunks = ['_csrf=' + token]
    req.on = vi.fn((event: string, cb: (chunk: Buffer) => void) => {
      if (event === 'data') {
        for (const chunk of bodyChunks) {
          cb(Buffer.from(chunk))
        }
      }
      if (event === 'end') {
        (cb as () => void)()
      }
      return req
    }) as unknown as typeof req.on

    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect(next).toHaveBeenCalledOnce()
  })

  it('rejects POST with 403 when tokens mismatch', async () => {
    const req = mockReq('POST', {
      cookie: '__val_csrf=' + 'a'.repeat(64),
      'x-csrf-token': 'b'.repeat(64)
    })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes).statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects POST with 403 when no CSRF token submitted', async () => {
    const req = mockReq('POST', {
      cookie: '__val_csrf=' + 'a'.repeat(64)
    })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes).statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects DELETE with 403 when tokens mismatch', async () => {
    const req = mockReq('DELETE', {
      cookie: '__val_csrf=' + 'a'.repeat(64),
      'x-csrf-token': 'c'.repeat(64)
    })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes).statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })

  it('rejects PATCH with 403 when tokens mismatch', async () => {
    const req = mockReq('PATCH', {
      cookie: '__val_csrf=' + 'a'.repeat(64),
      'x-csrf-token': 'd'.repeat(64)
    })
    const res = mockRes()
    const next = vi.fn(async () => {})

    await middleware(req, res, stubCtx(), next)

    expect((res as unknown as MockRes).statusCode).toBe(403)
    expect(next).not.toHaveBeenCalled()
  })
})
