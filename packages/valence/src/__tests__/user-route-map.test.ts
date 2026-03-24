import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { buildUserRouteMap } from '../route-generator.js'
import type { RouteConfig, LoaderContext, LoaderResult, ActionContext, ActionResult } from '../define-config.js'
import type { DbPool } from '@valencets/db'
import type { CmsInstance } from '@valencets/cms'

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

const pool = {} as DbPool
const cms = {} as CmsInstance

describe('buildUserRouteMap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns empty map for empty routes array', () => {
    const map = buildUserRouteMap([], '/fake/dir', pool, cms)
    expect(map.size).toBe(0)
  })

  it('returns empty map for undefined routes', () => {
    const map = buildUserRouteMap(undefined, '/fake/dir', pool, cms)
    expect(map.size).toBe(0)
  })

  it('registers a handler-based route at the correct path', () => {
    const handler = vi.fn()
    const routes: readonly RouteConfig[] = [
      { path: '/about', method: 'GET', handler }
    ]
    const map = buildUserRouteMap(routes, '/fake/dir', pool, cms)
    expect(map.has('/about')).toBe(true)
    expect(map.get('/about')?.has('GET')).toBe(true)
  })

  it('calls the custom handler directly for handler-based routes', async () => {
    const handler = vi.fn()
    const routes: readonly RouteConfig[] = [
      { path: '/about', method: 'GET', handler }
    ]
    const map = buildUserRouteMap(routes, '/fake/dir', pool, cms)
    const h = map.get('/about')?.get('GET')
    const req = makeReq()
    const res = makeRes()
    await h?.(req, res, {})
    expect(handler).toHaveBeenCalledWith(req, res, {})
  })

  it('defaults to GET when route has no method specified', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: {} })
    const routes: readonly RouteConfig[] = [
      { path: '/blog', loader }
    ]
    const map = buildUserRouteMap(routes, '/fake/dir', pool, cms)
    expect(map.get('/blog')?.has('GET')).toBe(true)
  })

  it('calls the loader and embeds data in HTML response', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      data: { posts: [] }
    })
    const routes: readonly RouteConfig[] = [
      { path: '/blog', loader }
    ]
    const map = buildUserRouteMap(routes, '/nonexistent/fake/dir', pool, cms)
    const h = map.get('/blog')?.get('GET')
    const req = makeReq()
    const res = makeRes()
    await h?.(req, res, {})
    const body = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(body).toContain('data-val-loader')
    expect(body).toContain('"posts"')
  })

  it('passes params to the loader context', async () => {
    const receivedParams: Record<string, string>[] = []
    const loader = async (ctx: LoaderContext): Promise<LoaderResult> => {
      receivedParams.push(ctx.params)
      return { data: {} }
    }
    const routes: readonly RouteConfig[] = [
      { path: '/posts/:id', loader }
    ]
    const map = buildUserRouteMap(routes, '/nonexistent/fake/dir', pool, cms)
    const h = map.get('/posts/:id')?.get('GET')
    const req = makeReq()
    const res = makeRes()
    await h?.(req, res, { id: '123' })
    expect(receivedParams[0]?.['id']).toBe('123')
  })

  it('passes query string to the loader context', async () => {
    const receivedQuery: URLSearchParams[] = []
    const loader = async (ctx: LoaderContext): Promise<LoaderResult> => {
      receivedQuery.push(ctx.query)
      return { data: {} }
    }
    const routes: readonly RouteConfig[] = [
      { path: '/blog', loader }
    ]
    const map = buildUserRouteMap(routes, '/nonexistent/fake/dir', pool, cms)
    const h = map.get('/blog')?.get('GET')
    const req = makeReq({ url: '/blog?page=3' })
    const res = makeRes()
    await h?.(req, res, {})
    expect(receivedQuery[0]?.get('page')).toBe('3')
  })

  it('sends 302 redirect when loader returns redirect', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      redirect: '/login'
    })
    const routes: readonly RouteConfig[] = [
      { path: '/protected', loader }
    ]
    const map = buildUserRouteMap(routes, '/nonexistent/fake/dir', pool, cms)
    const h = map.get('/protected')?.get('GET')
    const req = makeReq()
    const res = makeRes()
    await h?.(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(302, expect.objectContaining({ Location: '/login' }))
    expect(res.end).toHaveBeenCalled()
  })

  it('sends custom status code when loader returns status', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      status: 403,
      data: { error: 'forbidden' }
    })
    const routes: readonly RouteConfig[] = [
      { path: '/secret', loader }
    ]
    const map = buildUserRouteMap(routes, '/nonexistent/fake/dir', pool, cms)
    const h = map.get('/secret')?.get('GET')
    const req = makeReq()
    const res = makeRes()
    await h?.(req, res, {})
    const body = (res.end as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string
    expect(body).toContain('"error"')
    expect(body).toContain('"forbidden"')
  })

  it('sends 500 when loader fails', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => {
      throw new Error('DB down')
    }
    const routes: readonly RouteConfig[] = [
      { path: '/blog', loader }
    ]
    const map = buildUserRouteMap(routes, '/nonexistent/fake/dir', pool, cms)
    const h = map.get('/blog')?.get('GET')
    const req = makeReq()
    const res = makeRes()
    await h?.(req, res, {})
    expect(res.writeHead).toHaveBeenCalledWith(500, expect.any(Object))
  })

  it('registers POST handler for routes with action', () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const routes: readonly RouteConfig[] = [
      { path: '/contact', action }
    ]
    const map = buildUserRouteMap(routes, '/fake/dir', pool, cms)
    expect(map.get('/contact')?.has('POST')).toBe(true)
  })

  it('registers action routes with their explicit method', () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const routes: readonly RouteConfig[] = [
      { path: '/contact', method: 'PUT', action }
    ]
    const map = buildUserRouteMap(routes, '/fake/dir', pool, cms)
    expect(map.get('/contact')?.has('PUT')).toBe(true)
    expect(map.get('/contact')?.has('POST')).toBe(false)
  })

  it('defaults action routes to POST when method is omitted', () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const routes: readonly RouteConfig[] = [
      { path: '/contact', action }
    ]
    const map = buildUserRouteMap(routes, '/fake/dir', pool, cms)
    expect(map.get('/contact')?.has('POST')).toBe(true)
  })

  it('registers both GET (loader) and POST (action) for same path', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: {} })
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const routes: readonly RouteConfig[] = [
      { path: '/contact', loader, action }
    ]
    const map = buildUserRouteMap(routes, '/fake/dir', pool, cms)
    expect(map.get('/contact')?.has('GET')).toBe(true)
    expect(map.get('/contact')?.has('POST')).toBe(true)
  })
})
