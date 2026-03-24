import { describe, it, expect } from 'vitest'
import { defineConfig } from '../define-config.js'
import type {
  ValenceConfig,
  RouteConfig,
  LoaderContext,
  LoaderResult,
  ActionContext,
  ActionResult
} from '../define-config.js'

const minimalConfig: ValenceConfig = {
  db: {
    host: 'localhost',
    port: 5432,
    database: 'myapp',
    username: 'app',
    password: 'secret'
  },
  server: { port: 3000 },
  collections: []
}

describe('RouteConfig loader/action fields', () => {
  it('accepts a route with a loader function', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: { ok: true } })
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/blog', loader }]
    })
    expect(result.isOk()).toBe(true)
  })

  it('accepts a route with an action function', () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/blog', action }]
    })
    expect(result.isOk()).toBe(true)
  })

  it('accepts a route with both loader and action', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: { list: [] } })
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ data: { saved: true } })
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/contact', loader, action }]
    })
    expect(result.isOk()).toBe(true)
  })

  it('preserves loader function through defineConfig resolution', () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({ data: { x: 1 } })
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/blog', loader }]
    })
    const resolved = result.unwrap()
    expect(resolved.routes?.[0]?.loader).toBe(loader)
  })

  it('preserves action function through defineConfig resolution', () => {
    const action = async (_ctx: ActionContext): Promise<ActionResult> => ({ redirect: '/done' })
    const result = defineConfig({
      ...minimalConfig,
      routes: [{ path: '/blog', action }]
    })
    const resolved = result.unwrap()
    expect(resolved.routes?.[0]?.action).toBe(action)
  })

  it('routes without loader or action still work', () => {
    const routes: readonly RouteConfig[] = [{ path: '/about' }]
    const result = defineConfig({ ...minimalConfig, routes })
    expect(result.isOk()).toBe(true)
  })
})

describe('LoaderResult shape', () => {
  it('accepts data-only result', () => {
    const result: LoaderResult = { data: { posts: [] } }
    expect(result.data).toBeDefined()
  })

  it('accepts redirect result', () => {
    const result: LoaderResult = { redirect: '/login' }
    expect(result.redirect).toBe('/login')
  })

  it('accepts status-only result', () => {
    const result: LoaderResult = { status: 404 }
    expect(result.status).toBe(404)
  })

  it('accepts data + status result', () => {
    const result: LoaderResult = { data: { error: 'not found' }, status: 404 }
    expect(result.status).toBe(404)
    expect(result.data).toBeDefined()
  })

  it('accepts headers in result', () => {
    const result: LoaderResult = { data: {}, headers: { 'Cache-Control': 'no-store' } }
    expect(result.headers?.['Cache-Control']).toBe('no-store')
  })
})

describe('ActionResult shape', () => {
  it('accepts redirect result', () => {
    const result: ActionResult = { redirect: '/success' }
    expect(result.redirect).toBe('/success')
  })

  it('accepts errors result', () => {
    const result: ActionResult = { errors: { email: ['Invalid email'] } }
    expect(result.errors?.email).toEqual(['Invalid email'])
  })

  it('accepts data result', () => {
    const result: ActionResult = { data: { saved: true } }
    expect(result.data).toBeDefined()
  })

  it('accepts status in result', () => {
    const result: ActionResult = { status: 422, errors: { name: ['Required'] } }
    expect(result.status).toBe(422)
  })
})

describe('LoaderContext shape', () => {
  it('has params, query, req, pool, cms fields', () => {
    // Compile-time check that the interface has the right shape
    const ctx: LoaderContext = {
      params: { id: '42' },
      query: new URLSearchParams('page=1'),
      req: {} as LoaderContext['req'],
      pool: {} as LoaderContext['pool'],
      cms: {} as LoaderContext['cms']
    }
    expect(ctx.params['id']).toBe('42')
    expect(ctx.query.get('page')).toBe('1')
  })
})

describe('ActionContext shape', () => {
  it('has params, body, req, pool, cms fields', () => {
    const ctx: ActionContext = {
      params: { id: '1' },
      body: new URLSearchParams('name=Alice'),
      req: {} as ActionContext['req'],
      pool: {} as ActionContext['pool'],
      cms: {} as ActionContext['cms']
    }
    expect(ctx.params['id']).toBe('1')
    expect(ctx.body.get('name')).toBe('Alice')
  })
})
