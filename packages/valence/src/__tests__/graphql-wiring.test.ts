import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import { buildCms, collection, field } from '@valencets/cms'
import type { CmsInstance } from '@valencets/cms'
import { maybeRegisterGraphQL } from '../graphql-wiring.js'
import type { RouteHandler } from '../define-config.js'

// #350 — `graphql: true` was config-validated but nothing mounted
// POST /graphql. The wiring mounts the derived schema, gated behind a
// validated cms_session: the resolvers perform no per-collection access
// checks yet, so the endpoint inherits REST's auth-by-default posture.

function collectRoutes (): { registerRoute: (method: string, path: string, handler: RouteHandler) => void; routes: Map<string, RouteHandler> } {
  const routes = new Map<string, RouteHandler>()
  return {
    registerRoute: (method, path, handler) => { routes.set(`${method} ${path}`, handler) },
    routes
  }
}

function mockPool (): DbPool {
  const tagged = vi.fn(async () => [])
  const sql = Object.assign(tagged, {
    unsafe: vi.fn(async () => []),
    json: (v: unknown) => v,
    begin: vi.fn(async () => undefined)
  })
  return { sql } as unknown as DbPool
}

function makeCms (): CmsInstance {
  const result = buildCms({
    db: mockPool(),
    secret: 'x'.repeat(32),
    collections: [
      collection({ slug: 'posts', fields: [field.text({ name: 'title', required: true })] })
    ]
  })
  if (result.isErr()) return undefined as never
  return result.value
}

function postReq (body: string, cookie?: string): IncomingMessage {
  const emitter = new EventEmitter()
  const req = Object.assign(emitter, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(cookie !== undefined ? { cookie } : {}) },
    url: '/graphql'
  })
  setTimeout(() => {
    emitter.emit('data', Buffer.from(body))
    emitter.emit('end')
  }, 0)
  return req as unknown as IncomingMessage
}

function mockRes (): ServerResponse & { _status: number; _body: string } {
  const res = {
    _status: 0,
    _body: '',
    headersSent: false,
    writeHead (status: number) { res._status = status; return res },
    setHeader () { return res },
    end (body?: string) { res._body = body ?? ''; res.headersSent = true }
  }
  return res as unknown as ServerResponse & { _status: number; _body: string }
}

describe('maybeRegisterGraphQL', () => {
  it('mounts POST /graphql when enabled', async () => {
    const { registerRoute, routes } = collectRoutes()

    const mounted = await maybeRegisterGraphQL(true, registerRoute, makeCms(), async () => 'user-1')

    expect(mounted).toBe(true)
    expect(routes.has('POST /graphql')).toBe(true)
  })

  it('mounts nothing when disabled or unset', async () => {
    const { registerRoute, routes } = collectRoutes()

    expect(await maybeRegisterGraphQL(undefined, registerRoute, makeCms(), async () => 'user-1')).toBe(false)
    expect(await maybeRegisterGraphQL(false, registerRoute, makeCms(), async () => 'user-1')).toBe(false)
    expect(routes.size).toBe(0)
  })

  it('rejects requests without a valid cms_session (auth-by-default)', async () => {
    const { registerRoute, routes } = collectRoutes()
    await maybeRegisterGraphQL(true, registerRoute, makeCms(), async () => null)

    const anonymous = mockRes()
    await routes.get('POST /graphql')!(postReq('{"query":"{ __typename }"}'), anonymous, {})
    expect(anonymous._status).toBe(401)
    expect(JSON.parse(anonymous._body).errors[0].message).toContain('Unauthorized')

    const staleSession = mockRes()
    await routes.get('POST /graphql')!(postReq('{"query":"{ __typename }"}', 'cms_session=stale-token'), staleSession, {})
    expect(staleSession._status).toBe(401)
  })

  it('executes queries for a validated session', async () => {
    const { registerRoute, routes } = collectRoutes()
    const validate = vi.fn(async () => 'user-1')
    await maybeRegisterGraphQL(true, registerRoute, makeCms(), validate)

    const res = mockRes()
    await routes.get('POST /graphql')!(postReq('{"query":"{ __typename }"}', 'cms_session=valid-token'), res, {})

    expect(validate).toHaveBeenCalledWith('valid-token')
    expect(res._status).toBe(200)
    expect(JSON.parse(res._body).data.__typename).toBe('Query')
  })
})

describe('cli wiring', () => {
  it('both runDev and runStart mount the graphql endpoint', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.ts'),
      'utf-8'
    ).replace(/\r\n/g, '\n')

    const mounts = source.match(/maybeRegisterGraphQL\(/g) ?? []
    expect(mounts.length).toBeGreaterThanOrEqual(2)
  })
})
