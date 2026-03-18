import { describe, it, expect } from 'vitest'
import { EventEmitter } from 'node:events'
import type { ServerResponse, IncomingMessage } from 'node:http'
import { sendHtml, isFragmentRequest, readBody, MAX_BODY_BYTES } from '../http-helpers.js'

function mockRes (): ServerResponse & { _status: number; _headers: Record<string, string | number>; _body: string } {
  const res = {
    _status: 0,
    _headers: {} as Record<string, string | number>,
    _body: '',
    writeHead (status: number, headers?: Record<string, string | number>) {
      res._status = status
      if (headers) Object.assign(res._headers, headers)
      return res
    },
    end (body?: string) {
      if (body) res._body = body
    }
  }
  return res as unknown as ServerResponse & { _status: number; _headers: Record<string, string | number>; _body: string }
}

describe('sendHtml', () => {
  it('sends html with Content-Type header', () => {
    const res = mockRes()
    sendHtml(res, '<p>Hello</p>')
    expect(res._status).toBe(200)
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(res._body).toBe('<p>Hello</p>')
  })

  it('sends with custom status code', () => {
    const res = mockRes()
    sendHtml(res, '<p>Not Found</p>', 404)
    expect(res._status).toBe(404)
  })

  it('merges extra headers when provided', () => {
    const res = mockRes()
    sendHtml(res, '<p>Test</p>', 200, {
      'X-Valence-Version': 'abc123',
      'X-Valence-Title': 'Test Page'
    })
    expect(res._headers['X-Valence-Version']).toBe('abc123')
    expect(res._headers['X-Valence-Title']).toBe('Test Page')
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8')
  })

  it('works without extra headers (backward compatible)', () => {
    const res = mockRes()
    sendHtml(res, '<p>No extras</p>')
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(res._body).toBe('<p>No extras</p>')
  })
})

describe('isFragmentRequest', () => {
  it('returns true when X-Valence-Fragment is 1', () => {
    const req = { headers: { 'x-valence-fragment': '1' } } as unknown as IncomingMessage
    expect(isFragmentRequest(req)).toBe(true)
  })

  it('returns false when header is missing', () => {
    const req = { headers: {} } as unknown as IncomingMessage
    expect(isFragmentRequest(req)).toBe(false)
  })
})

describe('readBody', () => {
  function mockReq (): EventEmitter & IncomingMessage {
    const emitter = new EventEmitter()
    return emitter as EventEmitter & IncomingMessage
  }

  it('reads a normal body', async () => {
    const req = mockReq()
    const promise = readBody(req)
    req.emit('data', Buffer.from('hello'))
    req.emit('end')
    expect(await promise).toBe('hello')
  })

  it('rejects when body exceeds MAX_BODY_BYTES', async () => {
    const req = mockReq()
    const promise = readBody(req)
    const oversized = Buffer.alloc(MAX_BODY_BYTES + 1, 'x')
    req.emit('data', oversized)
    await expect(promise).rejects.toThrow('Body exceeds')
  })

  it('rejects when cumulative chunks exceed limit', async () => {
    const req = mockReq()
    const promise = readBody(req)
    const half = Buffer.alloc(Math.ceil(MAX_BODY_BYTES / 2) + 1, 'x')
    req.emit('data', half)
    req.emit('data', half)
    await expect(promise).rejects.toThrow('Body exceeds')
  })

  it('exports MAX_BODY_BYTES as a number', () => {
    expect(typeof MAX_BODY_BYTES).toBe('number')
    expect(MAX_BODY_BYTES).toBeGreaterThan(0)
  })
})

describe('sendIslandHtml', () => {
  it('sends html fragment with X-Valence-Fragment header', async () => {
    const { sendIslandHtml } = await import('../http-helpers.js')
    const res = mockRes()
    sendIslandHtml(res, '<p>Island content</p>')
    expect(res._status).toBe(200)
    expect(res._headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(res._headers['X-Valence-Fragment']).toBe('1')
    expect(res._body).toBe('<p>Island content</p>')
  })

  it('sets Cache-Control with maxAge option', async () => {
    const { sendIslandHtml } = await import('../http-helpers.js')
    const res = mockRes()
    sendIslandHtml(res, '<p>Cached island</p>', { maxAge: 60 })
    expect(res._headers['Cache-Control']).toBe('public, max-age=60, stale-while-revalidate=30')
  })

  it('defaults to no Cache-Control without maxAge', async () => {
    const { sendIslandHtml } = await import('../http-helpers.js')
    const res = mockRes()
    sendIslandHtml(res, '<p>No cache</p>')
    expect(res._headers['Cache-Control']).toBeUndefined()
  })
})
