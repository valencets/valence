import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRestRoutes } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { okAsync } from '@valencets/resultkit'

vi.mock('../auth/session.js', () => ({
  validateSession: vi.fn()
}))

import { validateSession } from '../auth/session.js'

const AUTH_COOKIE = 'cms_session=valid-session-id'

beforeEach(() => {
  vi.mocked(validateSession).mockReturnValue(okAsync('user-1'))
})

interface MockReq {
  method: string
  url: string
  headers: Record<string, string>
  on: ReturnType<typeof vi.fn>
  removeAllListeners: ReturnType<typeof vi.fn>
}

interface MockRes {
  writeHead: ReturnType<typeof vi.fn>
  end: ReturnType<typeof vi.fn>
  body: string
  _status: number
  statusCode: number
}

function makeMockReq (method: string, url: string, body: string = ''): IncomingMessage {
  const req: MockReq = {
    method,
    url,
    headers: { 'content-type': 'application/json', cookie: AUTH_COOKIE },
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === 'data' && body) cb(Buffer.from(body))
      if (event === 'end') cb()
      return req
    }),
    removeAllListeners: vi.fn(() => req)
  }
  return req as IncomingMessage
}

function makeMockRes (): ServerResponse & { body: string; _status: number } {
  const res: MockRes = {
    writeHead: vi.fn((status: number) => { res._status = status }),
    end: vi.fn((data?: string) => { res.body = data ?? '' }),
    body: '',
    _status: 0,
    statusCode: 200
  }
  return res as ServerResponse & { body: string; _status: number }
}

function setupLocaleRoutes () {
  const pool = makeMockPool([{ id: '1', title: '{"en":"Hello"}', slug: 'hello' }])
  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()
  collections.register(collection({
    slug: 'posts',
    fields: [
      field.text({ name: 'title', required: true, localized: true }),
      field.text({ name: 'slug', required: true })
    ]
  }))
  const localization = {
    defaultLocale: 'en',
    locales: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }] as const
  }
  const routes = createRestRoutes(pool, collections, globals, localization)
  return { pool, routes }
}

describe('REST API locale parameter support', () => {
  it('GET /api/posts?locale=es passes locale to query', async () => {
    const { routes } = setupLocaleRoutes()
    const handler = routes.get('/api/posts')?.GET
    expect(handler).toBeDefined()
    const req = makeMockReq('GET', '/api/posts?locale=es')
    const res = makeMockRes()
    await handler!(req, res, {})
    // Should succeed (200), not reject locale as unknown filter field
    expect(res._status).toBe(200)
  })

  it('GET /api/posts without locale succeeds normally', async () => {
    const { routes } = setupLocaleRoutes()
    const handler = routes.get('/api/posts')?.GET
    const req = makeMockReq('GET', '/api/posts')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res._status).toBe(200)
  })

  it('GET with invalid locale returns 400', async () => {
    const { routes } = setupLocaleRoutes()
    const handler = routes.get('/api/posts')?.GET
    const req = makeMockReq('GET', '/api/posts?locale=xx')
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res._status).toBe(400)
    const body = JSON.parse(res.body)
    expect(body.error).toContain('Invalid locale')
  })

  it('locale param is not treated as a filter field', async () => {
    const { routes } = setupLocaleRoutes()
    const handler = routes.get('/api/posts')?.GET
    const req = makeMockReq('GET', '/api/posts?locale=en')
    const res = makeMockRes()
    await handler!(req, res, {})
    // Without locale in RESERVED_PARAMS, this would fail with "Invalid filter field: locale"
    expect(res._status).not.toBe(400)
  })

  it('POST /api/posts?locale=en passes locale to create', async () => {
    const pool = makeMockPool([{ id: 'new-1', title: '{"en":"Hello"}', slug: 'hello' }])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true, localized: true }),
        field.text({ name: 'slug', required: true })
      ]
    }))
    const localization = {
      defaultLocale: 'en',
      locales: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }] as const
    }
    const routes = createRestRoutes(pool, collections, globals, localization)
    const handler = routes.get('/api/posts')?.POST
    const body = JSON.stringify({ title: 'Hello', slug: 'hello' })
    const req = makeMockReq('POST', '/api/posts?locale=en', body)
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res._status).toBe(201)
  })

  it('POST with invalid locale returns 400', async () => {
    const { routes } = setupLocaleRoutes()
    const handler = routes.get('/api/posts')?.POST
    const body = JSON.stringify({ title: 'Hello', slug: 'hello' })
    const req = makeMockReq('POST', '/api/posts?locale=xx', body)
    const res = makeMockRes()
    await handler!(req, res, {})
    expect(res._status).toBe(400)
    const parsed = JSON.parse(res.body)
    expect(parsed.error).toContain('Invalid locale')
  })

  it('PATCH /api/posts/:id?locale=es passes locale to update', async () => {
    const pool = makeMockPool([{ id: 'abc-123', title: '{"es":"Hola"}', slug: 'hello' }])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true, localized: true }),
        field.text({ name: 'slug', required: true })
      ]
    }))
    const localization = {
      defaultLocale: 'en',
      locales: [{ code: 'en', label: 'English' }, { code: 'es', label: 'Spanish' }] as const
    }
    const routes = createRestRoutes(pool, collections, globals, localization)
    const handler = routes.get('/api/posts/:id')?.PATCH
    const body = JSON.stringify({ title: 'Hola' })
    const req = makeMockReq('PATCH', '/api/posts/abc-123?locale=es', body)
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc-123' })
    expect(res._status).toBe(200)
  })

  it('PATCH with invalid locale returns 400', async () => {
    const { routes } = setupLocaleRoutes()
    const handler = routes.get('/api/posts/:id')?.PATCH
    const body = JSON.stringify({ title: 'Hola' })
    const req = makeMockReq('PATCH', '/api/posts/abc-123?locale=xx', body)
    const res = makeMockRes()
    await handler!(req, res, { id: 'abc-123' })
    expect(res._status).toBe(400)
    const parsed = JSON.parse(res.body)
    expect(parsed.error).toContain('Invalid locale')
  })

  it('locale param works without localization config (ignored)', async () => {
    const pool = makeMockPool([{ id: '1', title: 'Hello', slug: 'hello' }])
    const collections = createCollectionRegistry()
    const globals = createGlobalRegistry()
    collections.register(collection({
      slug: 'posts',
      fields: [
        field.text({ name: 'title', required: true }),
        field.text({ name: 'slug', required: true })
      ]
    }))
    // No localization config passed — locale param should be reserved but not validated
    const routes = createRestRoutes(pool, collections, globals)
    const handler = routes.get('/api/posts')?.GET
    const req = makeMockReq('GET', '/api/posts?locale=en')
    const res = makeMockRes()
    await handler!(req, res, {})
    // Should not fail with "Invalid filter field: locale" because locale is in RESERVED_PARAMS
    expect(res._status).toBe(200)
  })
})
