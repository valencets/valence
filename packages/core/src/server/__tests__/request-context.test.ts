import { describe, it, expect } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { createRequestContext, parseRequestUrl } from '../request-context.js'

function mockReq (url: string, host: string = 'localhost:3000'): IncomingMessage {
  return { url, method: 'GET', headers: { host } } as unknown as IncomingMessage
}

describe('createRequestContext', () => {
  it('returns a valid UUID for requestId', () => {
    const ctx = createRequestContext(mockReq('/test'), new URL('http://localhost:3000/test'))
    expect(ctx.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('generates different requestId each call', () => {
    const a = createRequestContext(mockReq('/'), new URL('http://localhost:3000/'))
    const b = createRequestContext(mockReq('/'), new URL('http://localhost:3000/'))
    expect(a.requestId).not.toBe(b.requestId)
  })

  it('startTime is a 2-element tuple', () => {
    const ctx = createRequestContext(mockReq('/'), new URL('http://localhost:3000/'))
    expect(ctx.startTime).toHaveLength(2)
    expect(typeof ctx.startTime[0]).toBe('number')
    expect(typeof ctx.startTime[1]).toBe('number')
  })

  it('url is parsed from req.url', () => {
    const ctx = createRequestContext(mockReq('/hello?foo=bar'), new URL('http://localhost:3000/hello?foo=bar'))
    expect(ctx.url.pathname).toBe('/hello')
    expect(ctx.url.searchParams.get('foo')).toBe('bar')
  })

  it('params defaults to empty object', () => {
    const ctx = createRequestContext(mockReq('/'), new URL('http://localhost:3000/'))
    expect(ctx.params).toEqual({})
  })

  it('params passed in are preserved', () => {
    const ctx = createRequestContext(mockReq('/users/42'), new URL('http://localhost:3000/users/42'), { id: '42' })
    expect(ctx.params).toEqual({ id: '42' })
  })

  it('parseRequestUrl returns Err for malformed host headers', () => {
    const result = parseRequestUrl(mockReq('/test', 'bad host'))
    expect(result.isErr()).toBe(true)
  })
})
