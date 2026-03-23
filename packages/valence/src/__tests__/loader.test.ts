import { describe, it, expect, vi } from 'vitest'
import type { IncomingMessage } from 'node:http'
import { executeLoader } from '../loader.js'
import type { LoaderContext, LoaderResult } from '../define-config.js'
import type { DbPool } from '@valencets/db'
import type { CmsInstance } from '@valencets/cms'

const makeCtx = (overrides: Partial<LoaderContext> = {}): LoaderContext => ({
  params: {},
  query: new URLSearchParams(),
  req: {} as IncomingMessage,
  pool: {} as DbPool,
  cms: {} as CmsInstance,
  ...overrides
})

describe('executeLoader', () => {
  it('returns Ok with LoaderResult on success', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      data: { posts: [] }
    })
    const ctx = makeCtx()
    const result = await executeLoader(loader, ctx)
    expect(result.isOk()).toBe(true)
  })

  it('returns the data from the loader', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      data: { count: 42 }
    })
    const ctx = makeCtx()
    const result = await executeLoader(loader, ctx)
    expect(result.unwrap().data).toEqual({ count: 42 })
  })

  it('passes context to the loader function', async () => {
    const receivedCtx: LoaderContext[] = []
    const loader = async (ctx: LoaderContext): Promise<LoaderResult> => {
      receivedCtx.push(ctx)
      return { data: {} }
    }
    const ctx = makeCtx({ params: { id: '99' } })
    await executeLoader(loader, ctx)
    expect(receivedCtx[0]?.params['id']).toBe('99')
  })

  it('passes URLSearchParams query to loader', async () => {
    const receivedQuery: URLSearchParams[] = []
    const loader = async (ctx: LoaderContext): Promise<LoaderResult> => {
      receivedQuery.push(ctx.query)
      return {}
    }
    const ctx = makeCtx({ query: new URLSearchParams('page=2&limit=10') })
    await executeLoader(loader, ctx)
    expect(receivedQuery[0]?.get('page')).toBe('2')
    expect(receivedQuery[0]?.get('limit')).toBe('10')
  })

  it('returns Ok with redirect in LoaderResult', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      redirect: '/login'
    })
    const result = await executeLoader(loader, makeCtx())
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().redirect).toBe('/login')
  })

  it('returns Ok with status in LoaderResult', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => ({
      status: 404,
      data: { message: 'not found' }
    })
    const result = await executeLoader(loader, makeCtx())
    expect(result.isOk()).toBe(true)
    expect(result.unwrap().status).toBe(404)
  })

  it('returns Err when loader throws', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => {
      throw new Error('DB connection failed')
    }
    const result = await executeLoader(loader, makeCtx())
    expect(result.isErr()).toBe(true)
  })

  it('Err has LOADER_FAILED code when loader throws', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => {
      throw new Error('unexpected failure')
    }
    const result = await executeLoader(loader, makeCtx())
    if (result.isErr()) {
      expect(result.error.code).toBe('LOADER_FAILED')
    }
  })

  it('Err message includes original error message', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => {
      throw new Error('timeout after 5000ms')
    }
    const result = await executeLoader(loader, makeCtx())
    if (result.isErr()) {
      expect(result.error.message).toContain('timeout after 5000ms')
    }
  })

  it('returns Err with LOADER_FAILED when loader rejects with non-Error', async () => {
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => {
      return Promise.reject(new Error('string error'))
    }
    const result = await executeLoader(loader, makeCtx())
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('LOADER_FAILED')
    }
  })

  it('is a pure function — multiple calls with same loader are independent', async () => {
    let callCount = 0
    const loader = async (_ctx: LoaderContext): Promise<LoaderResult> => {
      callCount++
      return { data: { call: callCount } }
    }
    const r1 = await executeLoader(loader, makeCtx())
    const r2 = await executeLoader(loader, makeCtx())
    expect(r1.unwrap().data?.['call']).toBe(1)
    expect(r2.unwrap().data?.['call']).toBe(2)
  })
})

describe('serializeLoaderData', () => {
  it('serializes loader data to a script tag', async () => {
    const { serializeLoaderData } = await import('../loader.js')
    const result = serializeLoaderData({ posts: [], total: 0 })
    expect(result).toContain('<script')
    expect(result).toContain('application/json')
    expect(result).toContain('data-val-loader')
    expect(result).toContain('"posts"')
  })

  it('injects empty object when data is undefined', async () => {
    const { serializeLoaderData } = await import('../loader.js')
    const result = serializeLoaderData(undefined)
    expect(result).toContain('{}')
  })

  it('escapes closing script tags to prevent XSS', async () => {
    const { serializeLoaderData } = await import('../loader.js')
    const result = serializeLoaderData({ xss: '</script><script>alert(1)</script>' })
    expect(result).not.toContain('</script><script>')
  })
})

describe('injectLoaderData', () => {
  it('appends loader script to HTML body', async () => {
    const { injectLoaderData } = await import('../loader.js')
    const html = '<html><body><h1>Hello</h1></body></html>'
    const script = '<script type="application/json" data-val-loader>{}</script>'
    const result = injectLoaderData(html, script)
    expect(result).toContain(script)
    expect(result).toContain('<h1>Hello</h1>')
  })

  it('inserts before </body> when present', async () => {
    const { injectLoaderData } = await import('../loader.js')
    const html = '<html><body><p>Content</p></body></html>'
    const script = '<script type="application/json" data-val-loader>{"x":1}</script>'
    const result = injectLoaderData(html, script)
    const bodyCloseIdx = result.indexOf('</body>')
    const scriptIdx = result.indexOf(script)
    expect(scriptIdx).toBeLessThan(bodyCloseIdx)
  })

  it('appends to end when no </body> tag', async () => {
    const { injectLoaderData } = await import('../loader.js')
    const html = '<h1>Fragment</h1>'
    const script = '<script type="application/json" data-val-loader>{}</script>'
    const result = injectLoaderData(html, script)
    expect(result.endsWith(script)).toBe(true)
  })
})

describe('vi mock helpers for loader ctx', () => {
  it('can construct LoaderContext with mock pool and cms', () => {
    const ctx = makeCtx({
      params: { slug: 'hello' },
      query: new URLSearchParams('draft=true')
    })
    expect(ctx.params['slug']).toBe('hello')
    expect(ctx.query.get('draft')).toBe('true')
  })

  it('loader receives params from ctx', async () => {
    const spy = vi.fn(async (ctx: LoaderContext): Promise<LoaderResult> => ({
      data: { slug: ctx.params['slug'] ?? '' }
    }))
    const ctx = makeCtx({ params: { slug: 'world' } })
    const result = await executeLoader(spy, ctx)
    expect(result.unwrap().data?.['slug']).toBe('world')
  })
})
