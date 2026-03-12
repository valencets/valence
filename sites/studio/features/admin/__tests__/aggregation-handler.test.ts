import { describe, it, expect, vi, afterEach } from 'vitest'
import { aggregationHandler } from '../server/aggregation-handler.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

afterEach(() => {
  vi.restoreAllMocks()
})

function mockReq (body: string, signature?: string): IncomingMessage {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (signature !== undefined) {
    headers['x-inertia-signature'] = signature
  }

  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {}
  const req = {
    headers,
    on (event: string, cb: (...args: unknown[]) => void) {
      if (!listeners[event]) listeners[event] = []
      listeners[event]?.push(cb)
      return req
    }
  } as unknown as IncomingMessage

  // Emit data + end asynchronously to simulate stream
  queueMicrotask(() => {
    for (const cb of listeners['data'] ?? []) cb(Buffer.from(body))
    for (const cb of listeners['end'] ?? []) cb()
  })

  return req
}

function mockRes (): { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; body: () => unknown; statusCode: () => number } {
  let raw = ''
  let status = 0
  const res = {
    writeHead: vi.fn((code: number) => { status = code }),
    end: vi.fn((data: string) => { raw = data })
  }
  return { ...res, body: () => JSON.parse(raw), statusCode: () => status }
}

function mockPool (): unknown {
  return { sql: async () => [{ id: 1 }] }
}

describe('aggregationHandler', () => {
  it('is a function', () => {
    expect(typeof aggregationHandler).toBe('function')
  })

  it('returns 200 OK with valid signed payload', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(), config: { siteSecret: 'test-secret' } }
    const body = JSON.stringify({
      site_id: 'site_acme',
      date: '2026-03-10',
      business_type: 'barbershop',
      schema_version: 1,
      session_count: 247,
      pageview_count: 1200,
      conversion_count: 45,
      top_referrers: [],
      top_pages: [],
      intent_counts: {},
      avg_flush_ms: 2.8,
      rejection_count: 5
    })

    const { signPayload } = await import('@inertia/ingestion')
    const sig = signPayload('test-secret', body)

    await aggregationHandler(mockReq(body, sig), res as unknown as ServerResponse, ctx as never)

    expect(res.statusCode()).toBe(200)
    expect(res.body()).toHaveProperty('ok', true)
  })

  it('returns 200 OK even with invalid signature (Black Hole)', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(), config: { siteSecret: 'test-secret' } }
    const body = JSON.stringify({ bad: 'data' })

    await aggregationHandler(mockReq(body, 'invalid-sig'), res as unknown as ServerResponse, ctx as never)

    expect(res.statusCode()).toBe(200)
    expect(res.body()).toHaveProperty('ok', true)
  })

  it('returns 200 OK with no signature (Black Hole)', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(), config: { siteSecret: 'test-secret' } }
    const body = JSON.stringify({})

    await aggregationHandler(mockReq(body), res as unknown as ServerResponse, ctx as never)

    expect(res.statusCode()).toBe(200)
    expect(res.body()).toHaveProperty('ok', true)
  })
})
