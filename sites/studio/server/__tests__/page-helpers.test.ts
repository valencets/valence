import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RouteContext } from '../types.js'
import type { CriticalCSSCache } from '../../features/budget/critical-css-pipeline.js'

function makeReq (headers: Record<string, string> = {}): IncomingMessage {
  return { headers } as unknown as IncomingMessage
}

function makeRes (): ServerResponse & { writtenData: string; writtenStatus: number } {
  const res = {
    writtenData: '',
    writtenStatus: 200,
    setHeader: vi.fn(),
    writeHead: vi.fn(function (this: { writtenStatus: number }, code: number) { this.writtenStatus = code }),
    end: vi.fn(function (this: { writtenData: string }, data: string) { this.writtenData = data })
  } as unknown as ServerResponse & { writtenData: string; writtenStatus: number }
  return res
}

function makeCtx (criticalCSS?: string): RouteContext {
  const pipeline: CriticalCSSCache = {
    getCriticalCSS: () => criticalCSS,
    getDeferredCSS: () => undefined
  }
  return {
    pool: {} as RouteContext['pool'],
    config: {} as RouteContext['config'],
    cssPipeline: pipeline
  }
}

describe('respondWithPage', () => {
  let respondWithPage: typeof import('../page-helpers.js').respondWithPage

  beforeEach(async () => {
    vi.resetModules()
    const mod = await import('../page-helpers.js')
    respondWithPage = mod.respondWithPage
  })

  it('sends fragment when X-Inertia-Fragment header is set', () => {
    const req = makeReq({ 'x-inertia-fragment': '1' })
    const res = makeRes()
    const ctx = makeCtx()

    respondWithPage(req, res, ctx, {
      title: 'Test',
      description: 'desc',
      deferredCSSPath: '/css/studio.css',
      mainContent: '<p>hello</p>',
      currentPath: '/'
    })

    expect(res.writtenData).toBe('<p>hello</p>')
  })

  it('sends full shell with critical CSS injected', () => {
    const req = makeReq({})
    const res = makeRes()
    const ctx = makeCtx('body{color:red}')

    respondWithPage(req, res, ctx, {
      title: 'Test',
      description: 'desc',
      deferredCSSPath: '/css/studio.css',
      mainContent: '<p>hello</p>',
      currentPath: '/'
    })

    expect(res.writtenData).toContain('<style>body{color:red}</style>')
    expect(res.writtenData).toContain('<p>hello</p>')
  })

  it('respects custom status code', () => {
    const req = makeReq({})
    const res = makeRes()
    const ctx = makeCtx()

    respondWithPage(req, res, ctx, {
      title: 'Not Found',
      description: 'desc',
      deferredCSSPath: '/css/studio.css',
      mainContent: '<p>404</p>',
      currentPath: ''
    }, 404)

    expect(res.writtenStatus).toBe(404)
  })

  it('uses empty string when pipeline has no CSS for route', () => {
    const req = makeReq({})
    const res = makeRes()
    const pipeline: CriticalCSSCache = {
      getCriticalCSS: () => undefined,
      getDeferredCSS: () => undefined
    }
    const ctx: RouteContext = {
      pool: {} as RouteContext['pool'],
      config: {} as RouteContext['config'],
      cssPipeline: pipeline
    }

    respondWithPage(req, res, ctx, {
      title: 'Test',
      description: 'desc',
      deferredCSSPath: '/css/studio.css',
      mainContent: '<p>hi</p>',
      currentPath: '/unknown'
    })

    expect(res.writtenData).toContain('<style></style>')
  })
})
