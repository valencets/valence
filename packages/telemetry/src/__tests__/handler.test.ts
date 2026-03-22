import { describe, it, expect } from 'vitest'
import { createIngestionHandler } from '../handler.js'

import { makeMockPool } from '@valencets/db/test'

function mockReq (body: string, method = 'POST'): import('node:http').IncomingMessage {
  const req = {
    method,
    headers: { 'content-type': 'application/json' },
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
})
