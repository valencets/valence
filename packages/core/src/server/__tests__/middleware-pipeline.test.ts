import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { composeMiddleware } from '../middleware-pipeline.js'
import type { RequestContext, Middleware } from '../middleware-types.js'

function stubCtx (): RequestContext {
  return {
    requestId: 'test-id',
    startTime: [0, 0] as readonly [number, number],
    url: new URL('http://localhost/'),
    params: {}
  }
}

const stubReq = {} as IncomingMessage
const stubRes = {} as ServerResponse

describe('composeMiddleware', () => {
  it('empty list calls final handler directly', async () => {
    const final = vi.fn(async () => {})
    const composed = composeMiddleware([])
    await composed(stubReq, stubRes, stubCtx(), final)
    expect(final).toHaveBeenCalledOnce()
  })

  it('single middleware wraps handler correctly', async () => {
    const order: string[] = []
    const mw: Middleware = async (_req, _res, _ctx, next) => {
      order.push('mw-before')
      await next()
      order.push('mw-after')
    }
    const final = vi.fn(async () => { order.push('final') })

    const composed = composeMiddleware([mw])
    await composed(stubReq, stubRes, stubCtx(), final)

    expect(order).toEqual(['mw-before', 'final', 'mw-after'])
  })

  it('multiple middleware execute in FIFO order', async () => {
    const order: string[] = []
    const mw1: Middleware = async (_req, _res, _ctx, next) => {
      order.push('mw1')
      await next()
    }
    const mw2: Middleware = async (_req, _res, _ctx, next) => {
      order.push('mw2')
      await next()
    }
    const final = vi.fn(async () => { order.push('final') })

    const composed = composeMiddleware([mw1, mw2])
    await composed(stubReq, stubRes, stubCtx(), final)

    expect(order).toEqual(['mw1', 'mw2', 'final'])
  })

  it('middleware that skips next() short-circuits', async () => {
    const final = vi.fn(async () => {})
    const guard: Middleware = async () => {
      // does not call next
    }

    const composed = composeMiddleware([guard])
    await composed(stubReq, stubRes, stubCtx(), final)

    expect(final).not.toHaveBeenCalled()
  })

  it('code after await next() runs in reverse order (onion)', async () => {
    const order: string[] = []
    const mw1: Middleware = async (_req, _res, _ctx, next) => {
      order.push('mw1-in')
      await next()
      order.push('mw1-out')
    }
    const mw2: Middleware = async (_req, _res, _ctx, next) => {
      order.push('mw2-in')
      await next()
      order.push('mw2-out')
    }
    const final = vi.fn(async () => { order.push('final') })

    const composed = composeMiddleware([mw1, mw2])
    await composed(stubReq, stubRes, stubCtx(), final)

    expect(order).toEqual(['mw1-in', 'mw2-in', 'final', 'mw2-out', 'mw1-out'])
  })

  it('error in middleware propagates up', async () => {
    const mw: Middleware = async () => {
      throw new Error('middleware boom')
    }
    const final = vi.fn(async () => {})

    const composed = composeMiddleware([mw])
    await expect(composed(stubReq, stubRes, stubCtx(), final)).rejects.toThrow('middleware boom')
  })

  it('error in final handler propagates through middleware chain', async () => {
    const afterNext = vi.fn()
    const mw: Middleware = async (_req, _res, _ctx, next) => {
      await next()
      afterNext()
    }
    const final = vi.fn(async () => { throw new Error('handler boom') })

    const composed = composeMiddleware([mw])
    await expect(composed(stubReq, stubRes, stubCtx(), final)).rejects.toThrow('handler boom')
    expect(afterNext).not.toHaveBeenCalled()
  })

  it('throws if next() is called multiple times', async () => {
    const mw: Middleware = async (_req, _res, _ctx, next) => {
      await next()
      await next()
    }
    const final = vi.fn(async () => {})

    const composed = composeMiddleware([mw])
    await expect(composed(stubReq, stubRes, stubCtx(), final)).rejects.toThrow('next() called multiple times')
  })
})
