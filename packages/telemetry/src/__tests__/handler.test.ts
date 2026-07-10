import { describe, it, expect, vi } from 'vitest'
import { createIngestionHandler } from '../handler.js'
import type { DbPool } from '@valencets/db'

import { makeMockPool } from '@valencets/db/test'

// A pool whose every entry point counts invocations — lets tests assert
// the database was never touched.
function countingPool (): { pool: DbPool; touched: () => number } {
  const tagged = vi.fn(async () => Object.assign([{ session_id: 's1' }], { count: 1 }))
  const sql = Object.assign(
    tagged,
    {
      unsafe: vi.fn(async () => []),
      json: (v: unknown) => v,
      begin: vi.fn(async () => undefined)
    }
  )
  return {
    pool: { sql } as unknown as DbPool,
    touched: () => tagged.mock.calls.length + sql.unsafe.mock.calls.length
  }
}

function mockReq (body: string, method = 'POST', headers?: Record<string, string>): import('node:http').IncomingMessage {
  const req = {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    url: '/api/telemetry'
  } as import('node:http').IncomingMessage

  // Simulate readable stream
  const chunks = [Buffer.from(body)]

  req.on = ((event: string, cb: (chunk: Buffer) => void) => {
    if (event === 'data') {
      for (const chunk of chunks) cb(chunk)
    }
    if (event === 'end') {
      setTimeout(() => cb(null as never), 0)
    }
    return req
  }) as typeof req.on

  return req
}

function mockRes (): import('node:http').ServerResponse & { _status: number; _body: string } {
  const res = {
    _status: 200,
    _body: '',
    _headers: {} as Record<string, string>,
    headersSent: false,
    writeHead (status: number) { res._status = status; return res },
    setHeader (key: string, value: string) { res._headers[key] = value; return res },
    end (body?: string) { res._body = body ?? ''; res.headersSent = true }
  }
  return res as never
}

describe('createIngestionHandler', () => {
  it('returns a handler function', () => {
    const pool = makeMockPool([])
    const handler = createIngestionHandler({ pool })
    expect(typeof handler).toBe('function')
  })

  it('returns 200 on valid beacon payload', async () => {
    const pool = makeMockPool([{ id: 'session-1' }])
    const handler = createIngestionHandler({ pool })
    const payload = JSON.stringify([{
      id: 'evt-1',
      timestamp: Date.now(),
      type: 'CLICK',
      targetDOMNode: 'button.cta',
      x_coord: 100,
      y_coord: 200,
      isDirty: false,
      schema_version: 1,
      site_id: 'test-site',
      path: '/',
      referrer: ''
    }])
    const res = mockRes()
    await handler(mockReq(payload), res as never)
    expect(res._status).toBe(200)
  })

  // #349 audit — the beacon endpoint buffered request bodies without any
  // size cap and waited for 'end' forever. Once the cap is exceeded the
  // handler must answer immediately (silent-accept 200, nothing stored)
  // instead of buffering an attacker's unbounded stream.
  it('answers oversized bodies at the cap without waiting for the stream to end', async () => {
    const { pool, touched } = countingPool()
    const handler = createIngestionHandler({ pool })

    // A stream that pushes 300 KB and never emits 'end'
    const { EventEmitter } = await import('node:events')
    const emitter = new EventEmitter()
    const req = Object.assign(emitter, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      url: '/api/telemetry'
    })
    setTimeout(() => {
      for (let i = 0; i < 30; i++) {
        emitter.emit('data', Buffer.alloc(10_000, 120))
      }
      // no 'end' — the handler must have already answered
    }, 0)

    const res = mockRes()
    await handler(req as never, res as never)

    expect(res._status).toBe(200)
    const body = JSON.parse(res._body) as { ok: boolean; ingested: number }
    expect(body.ok).toBe(true)
    expect(body.ingested).toBe(0)
    expect(touched()).toBe(0)
  }, 4000)

  it('returns 200 on invalid payload (silent accept)', async () => {
    const pool = makeMockPool([])
    const handler = createIngestionHandler({ pool })
    const res = mockRes()
    await handler(mockReq('not json'), res as never)
    // Silent accept: always 200 to prevent client retries
    expect(res._status).toBe(200)
  })

  it('returns 200 on empty array', async () => {
    const pool = makeMockPool([])
    const handler = createIngestionHandler({ pool })
    const res = mockRes()
    await handler(mockReq('[]'), res as never)
    expect(res._status).toBe(200)
  })

  it('returns 200 with ingested 0 when DNT header is "1"', async () => {
    const pool = makeMockPool([])
    const handler = createIngestionHandler({ pool })
    const payload = JSON.stringify([{
      id: 'evt-1',
      timestamp: Date.now(),
      type: 'CLICK',
      targetDOMNode: 'button.cta',
      x_coord: 100,
      y_coord: 200,
      isDirty: false,
      schema_version: 1,
      site_id: 'test-site',
      path: '/',
      referrer: ''
    }])
    const res = mockRes()
    await handler(mockReq(payload, 'POST', { dnt: '1' }), res as never)
    expect(res._status).toBe(200)
    const body = JSON.parse(res._body) as { ok: boolean; ingested: number }
    expect(body.ingested).toBe(0)
  })

  it('processes normally when DNT header is "0"', async () => {
    const pool = makeMockPool([{ id: 'session-1' }])
    const handler = createIngestionHandler({ pool })
    const payload = JSON.stringify([{
      id: 'evt-1',
      timestamp: Date.now(),
      type: 'CLICK',
      targetDOMNode: 'button.cta',
      x_coord: 100,
      y_coord: 200,
      isDirty: false,
      schema_version: 1,
      site_id: 'test-site',
      path: '/',
      referrer: ''
    }])
    const res = mockRes()
    await handler(mockReq(payload, 'POST', { dnt: '0' }), res as never)
    expect(res._status).toBe(200)
  })

  it('processes normally when DNT header is absent', async () => {
    const pool = makeMockPool([{ id: 'session-1' }])
    const handler = createIngestionHandler({ pool })
    const payload = JSON.stringify([{
      id: 'evt-1',
      timestamp: Date.now(),
      type: 'CLICK',
      targetDOMNode: 'button.cta',
      x_coord: 100,
      y_coord: 200,
      isDirty: false,
      schema_version: 1,
      site_id: 'test-site',
      path: '/',
      referrer: ''
    }])
    const res = mockRes()
    await handler(mockReq(payload, 'POST'), res as never)
    expect(res._status).toBe(200)
  })
})
