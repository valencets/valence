import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import { maybeRegisterTelemetry } from '../telemetry-wiring.js'
import type { RouteHandler } from '../define-config.js'

// #349 — the config promises `telemetry.endpoint` and the client beacons
// to it, but nothing mounted the ingestion handler: beacons 404'd. The
// wiring registers the silent-accept handler at the configured endpoint.

function collectRoutes (): { registerRoute: (method: string, path: string, handler: RouteHandler) => void; routes: Map<string, RouteHandler> } {
  const routes = new Map<string, RouteHandler>()
  return {
    registerRoute: (method, path, handler) => { routes.set(`${method} ${path}`, handler) },
    routes
  }
}

function beaconPool (): DbPool {
  const tagged = vi.fn(async () => Object.assign([{ session_id: 's1' }], { count: 1 }))
  const sql = Object.assign(tagged, {
    unsafe: vi.fn(async () => []),
    json: (v: unknown) => v,
    begin: vi.fn(async () => undefined)
  })
  return { sql } as unknown as DbPool
}

function postReq (body: string, headers?: { [key: string]: string }): IncomingMessage {
  const emitter = new EventEmitter()
  const req = Object.assign(emitter, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(headers ?? {}) },
    url: '/api/telemetry'
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

describe('maybeRegisterTelemetry', () => {
  it('mounts POST at the configured endpoint when telemetry is enabled', () => {
    const { registerRoute, routes } = collectRoutes()

    const mounted = maybeRegisterTelemetry(
      { enabled: true, endpoint: '/api/telemetry', siteId: 'test' },
      registerRoute,
      beaconPool()
    )

    expect(mounted).toBe(true)
    expect(routes.has('POST /api/telemetry')).toBe(true)
  })

  it('mounts nothing when telemetry is disabled or unconfigured', () => {
    const { registerRoute, routes } = collectRoutes()

    expect(maybeRegisterTelemetry(undefined, registerRoute, beaconPool())).toBe(false)
    expect(maybeRegisterTelemetry({ enabled: false, endpoint: '/api/telemetry', siteId: 'test' }, registerRoute, beaconPool())).toBe(false)
    expect(routes.size).toBe(0)
  })

  it('the mounted handler answers a valid beacon with the silent-accept envelope', async () => {
    const { registerRoute, routes } = collectRoutes()
    maybeRegisterTelemetry({ enabled: true, endpoint: '/api/telemetry', siteId: 'test' }, registerRoute, beaconPool())

    const payload = JSON.stringify([{
      id: 'evt-1',
      timestamp: Date.now(),
      type: 'CLICK',
      targetDOMNode: 'button.cta',
      x_coord: 1,
      y_coord: 2,
      isDirty: false,
      schema_version: 1,
      site_id: 'test-site',
      path: '/',
      referrer: ''
    }])
    const res = mockRes()
    await routes.get('POST /api/telemetry')!(postReq(payload), res, {})

    expect(res._status).toBe(200)
    expect(JSON.parse(res._body).ok).toBe(true)
  })

  it('respects DNT on the mounted endpoint', async () => {
    const { registerRoute, routes } = collectRoutes()
    const pool = beaconPool()
    maybeRegisterTelemetry({ enabled: true, endpoint: '/api/telemetry', siteId: 'test' }, registerRoute, pool)

    const res = mockRes()
    await routes.get('POST /api/telemetry')!(postReq('[]', { dnt: '1' }), res, {})

    expect(res._status).toBe(200)
    expect(JSON.parse(res._body).ingested).toBe(0)
    expect((pool.sql as unknown as ReturnType<typeof vi.fn>).mock.calls).toHaveLength(0)
  })
})

describe('cli wiring', () => {
  it('both runDev and runStart mount the ingestion endpoint', async () => {
    const { readFileSync } = await import('node:fs')
    const { join, dirname } = await import('node:path')
    const { fileURLToPath } = await import('node:url')
    const source = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '..', 'cli.ts'),
      'utf-8'
    ).replace(/\r\n/g, '\n')

    const mounts = source.match(/maybeRegisterTelemetry\(/g) ?? []
    // one import + one call in runDev + one call in runStart
    expect(mounts.length).toBeGreaterThanOrEqual(2)
  })
})
