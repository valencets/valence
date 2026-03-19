import { describe, it, expect, expectTypeOf } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext, Middleware, ErrorHandler } from '../middleware-types.js'

describe('middleware types', () => {
  it('RequestContext has required readonly fields', () => {
    const ctx: RequestContext = {
      requestId: '550e8400-e29b-41d4-a716-446655440000',
      startTime: [0, 0] as readonly [number, number],
      url: new URL('http://localhost/test'),
      params: {}
    }
    expect(ctx.requestId).toBe('550e8400-e29b-41d4-a716-446655440000')
    expect(ctx.startTime).toEqual([0, 0])
    expect(ctx.url.pathname).toBe('/test')
    expect(ctx.params).toEqual({})
  })

  it('RequestContext params preserves values', () => {
    const ctx: RequestContext = {
      requestId: 'abc',
      startTime: [1, 2] as readonly [number, number],
      url: new URL('http://localhost/users/42'),
      params: { id: '42' }
    }
    expect(ctx.params.id).toBe('42')
  })

  it('Middleware type accepts a valid function', () => {
    const mw: Middleware = async (_req, _res, _ctx, next) => {
      await next()
    }
    expectTypeOf(mw).toBeFunction()
    expectTypeOf(mw).parameters.toMatchTypeOf<[IncomingMessage, ServerResponse, RequestContext, () => Promise<void>]>()
  })

  it('ErrorHandler type accepts a valid function', () => {
    const handler: ErrorHandler = async (_error, _req, _res, _ctx) => {
      // handle error
    }
    expectTypeOf(handler).toBeFunction()
    expectTypeOf(handler).parameters.toMatchTypeOf<[Error, IncomingMessage, ServerResponse, RequestContext]>()
  })
})
