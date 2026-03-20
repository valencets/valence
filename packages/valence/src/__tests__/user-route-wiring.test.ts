/**
 * Tests for the wiring of user-defined routes (with loaders/actions) into
 * the request resolution chain. These tests verify the merging behaviour
 * of buildUserRouteMap with the custom route map used by the server.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildUserRouteMap } from '../route-generator.js'
import { resolveCustomRoute } from '../route-matcher.js'
import type { RouteConfig, LoaderContext, LoaderResult, ActionContext, ActionResult } from '../define-config.js'
import type { DbPool } from '@valencets/db'
import type { CmsInstance } from '@valencets/cms'

const pool = {} as DbPool
const cms = {} as CmsInstance

const makeRes = (): ServerResponse => {
  const res = {
    writeHead: vi.fn(),
    end: vi.fn(),
    getHeader: vi.fn(),
    setHeader: vi.fn()
  }
  return res as unknown as ServerResponse
}

const makeReq = (overrides: Partial<{ headers: Record<string, string>, method: string, url: string }> = {}): IncomingMessage => {
  return {
    headers: {},
    method: 'GET',
    url: '/',
    ...overrides
  } as unknown as IncomingMessage
}

describe('user route map integration with resolveCustomRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('a loader route is found via resolveCustomRoute', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: {} })
    const routes: readonly RouteConfig[] = [{ path: '/blog', loader }]
    const map = buildUserRouteMap(routes, '/fake', pool, cms)
    const match = resolveCustomRoute(map, 'GET', '/blog')
    expect(match).not.toBeNull()
    expect(typeof match?.handler).toBe('function')
  })

  it('an action route is found via resolveCustomRoute for POST', () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const routes: readonly RouteConfig[] = [{ path: '/contact', action }]
    const map = buildUserRouteMap(routes, '/fake', pool, cms)
    const match = resolveCustomRoute(map, 'POST', '/contact')
    expect(match).not.toBeNull()
  })

  it('loader route does NOT match POST', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: {} })
    const routes: readonly RouteConfig[] = [{ path: '/blog', loader }]
    const map = buildUserRouteMap(routes, '/fake', pool, cms)
    const match = resolveCustomRoute(map, 'POST', '/blog')
    expect(match).toBeNull()
  })

  it('action route does NOT match GET when only action is defined', () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const routes: readonly RouteConfig[] = [{ path: '/contact', action }]
    const map = buildUserRouteMap(routes, '/fake', pool, cms)
    const match = resolveCustomRoute(map, 'GET', '/contact')
    expect(match).toBeNull()
  })

  it('when both loader and action, GET resolves loader and POST resolves action', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: { form: true } })
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const routes: readonly RouteConfig[] = [{ path: '/form', loader, action }]
    const map = buildUserRouteMap(routes, '/fake', pool, cms)
    expect(resolveCustomRoute(map, 'GET', '/form')).not.toBeNull()
    expect(resolveCustomRoute(map, 'POST', '/form')).not.toBeNull()
  })

  it('params are passed through resolveCustomRoute to loader', async () => {
    const receivedParams: Record<string, string>[] = []
    const loader = async (ctx: LoaderContext): Promise<LoaderResult> => {
      receivedParams.push(ctx.params)
      return { data: {} }
    }
    const routes: readonly RouteConfig[] = [{ path: '/posts/:id', loader }]
    const map = buildUserRouteMap(routes, '/nonexistent', pool, cms)
    const match = resolveCustomRoute(map, 'GET', '/posts/42')
    const req = makeReq()
    const res = makeRes()
    await match?.handler(req, res, match.params)
    expect(receivedParams[0]?.['id']).toBe('42')
  })

  it('action receives POSTed body parsed from URLSearchParams', async () => {
    const receivedBody: URLSearchParams[] = []
    const action = async (ctx: ActionContext): Promise<ActionResult> => {
      receivedBody.push(ctx.body)
      return { redirect: '/done' }
    }
    const routes: readonly RouteConfig[] = [{ path: '/submit', action }]
    const map = buildUserRouteMap(routes, '/nonexistent', pool, cms)
    const match = resolveCustomRoute(map, 'POST', '/submit')

    // Simulate a POST request with form body
    const eventHandlers = new Map<string, (arg: Buffer | Error) => void>()
    const req = {
      headers: {},
      method: 'POST',
      url: '/submit',
      on: vi.fn((event: string, handler: (arg: Buffer | Error) => void) => {
        eventHandlers.set(event, handler)
        return req
      })
    } as unknown as IncomingMessage

    const res = makeRes()
    const handlerPromise = match?.handler(req, res, {})

    // Emit data + end
    eventHandlers.get('data')?.(Buffer.from('name=Bob'))
    eventHandlers.get('end')?.(Buffer.from(''))

    await handlerPromise
    expect(receivedBody[0]?.get('name')).toBe('Bob')
  })

  it('user route map can be merged with custom route map (like cli.ts does)', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: {} })
    const userRoutes: readonly RouteConfig[] = [{ path: '/blog', loader }]
    const userMap = buildUserRouteMap(userRoutes, '/fake', pool, cms)

    // Custom routes (from onServer registerRoute) take priority
    const customRoutes = new Map<string, Map<string, import('../define-config.js').RouteHandler>>()
    const overrideHandler = vi.fn()
    customRoutes.set('/blog', new Map([['GET', overrideHandler]]))

    // Priority: custom first, then user routes
    const matchCustom = resolveCustomRoute(customRoutes, 'GET', '/blog')
    const matchUser = resolveCustomRoute(userMap, 'GET', '/blog')

    // Both match, but custom takes priority in the resolution chain
    expect(matchCustom).not.toBeNull()
    expect(matchUser).not.toBeNull()
    expect(matchCustom?.handler).toBe(overrideHandler)
  })
})

describe('loader error handling at route level', () => {
  it('sends 500 when loader throws unexpectedly', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => {
      throw new Error('unexpected error')
    }
    const routes: readonly RouteConfig[] = [{ path: '/broken', loader }]
    const map = buildUserRouteMap(routes, '/nonexistent', pool, cms)
    const match = resolveCustomRoute(map, 'GET', '/broken')

    const req = makeReq()
    const res = makeRes()
    await match?.handler(req, res, {})

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object))
  })

  it('sends 302 when loader returns a redirect', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      redirect: '/login'
    })
    const routes: readonly RouteConfig[] = [{ path: '/secure', loader }]
    const map = buildUserRouteMap(routes, '/nonexistent', pool, cms)
    const match = resolveCustomRoute(map, 'GET', '/secure')

    const req = makeReq()
    const res = makeRes()
    await match?.handler(req, res, {})

    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/login' }))
    expect(res.end).toHaveBeenCalled()
  })
})

describe('action error handling at route level', () => {
  it('sends 500 when action throws unexpectedly', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => {
      throw new Error('DB write failed')
    }
    const routes: readonly RouteConfig[] = [{ path: '/submit', action }]
    const map = buildUserRouteMap(routes, '/nonexistent', pool, cms)
    const match = resolveCustomRoute(map, 'POST', '/submit')

    const eventHandlers = new Map<string, (arg: Buffer | Error) => void>()
    const req = {
      headers: {},
      method: 'POST',
      url: '/submit',
      on: vi.fn((event: string, handler: (arg: Buffer | Error) => void) => {
        eventHandlers.set(event, handler)
        return req
      })
    } as unknown as IncomingMessage

    const res = makeRes()
    const handlerPromise = match?.handler(req, res, {})
    eventHandlers.get('data')?.(Buffer.from(''))
    eventHandlers.get('end')?.(Buffer.from(''))
    await handlerPromise

    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object))
  })

  it('sends 302 when action returns a redirect', async () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({
      redirect: '/success'
    })
    const routes: readonly RouteConfig[] = [{ path: '/submit', action }]
    const map = buildUserRouteMap(routes, '/nonexistent', pool, cms)
    const match = resolveCustomRoute(map, 'POST', '/submit')

    const eventHandlers = new Map<string, (arg: Buffer | Error) => void>()
    const req = {
      headers: {},
      method: 'POST',
      url: '/submit',
      on: vi.fn((event: string, handler: (arg: Buffer | Error) => void) => {
        eventHandlers.set(event, handler)
        return req
      })
    } as unknown as IncomingMessage

    const res = makeRes()
    const handlerPromise = match?.handler(req, res, {})
    eventHandlers.get('data')?.(Buffer.from(''))
    eventHandlers.get('end')?.(Buffer.from(''))
    await handlerPromise

    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/success' }))
  })
})
