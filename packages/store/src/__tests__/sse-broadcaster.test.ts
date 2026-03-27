import { describe, it, expect, beforeEach } from 'vitest'
import { SSEBroadcaster } from '../server/sse-broadcaster.js'
import { EventEmitter } from 'node:events'
import type { ServerResponse } from 'node:http'

function mockRes (): ServerResponse & { _written: string[]; _ended: boolean; _headers: { [key: string]: string } } {
  const emitter = new EventEmitter()
  const res = Object.assign(emitter, {
    _written: [] as string[],
    _ended: false,
    _headers: {} as { [key: string]: string },
    writeHead (status: number, headers?: { [key: string]: string }) {
      if (headers) Object.assign(res._headers, headers)
    },
    setHeader (name: string, value: string) {
      res._headers[name] = value
    },
    write (chunk: string) {
      res._written.push(chunk)
      return true
    },
    end () {
      res._ended = true
    },
    flushHeaders () {}
  })
  return res as ServerResponse & { _written: string[]; _ended: boolean; _headers: { [key: string]: string } }
}

describe('SSEBroadcaster', () => {
  let broadcaster: SSEBroadcaster

  beforeEach(() => {
    broadcaster = SSEBroadcaster.create()
  })

  it('starts with zero connections', () => {
    expect(broadcaster.connectionCount('counter')).toBe(0)
  })

  it('addClient registers a connection', () => {
    const res = mockRes()
    broadcaster.addClient('counter', 'session-1', res as ServerResponse)
    expect(broadcaster.connectionCount('counter')).toBe(1)
  })

  it('addClient sets SSE headers', () => {
    const res = mockRes()
    broadcaster.addClient('counter', 'session-1', res as ServerResponse)
    expect(res._headers['content-type']).toBe('text/event-stream')
    expect(res._headers['cache-control']).toBe('no-cache')
    expect(res._headers['connection']).toBe('keep-alive')
  })

  it('broadcast sends event to all connected clients for a store', () => {
    const res1 = mockRes()
    const res2 = mockRes()
    broadcaster.addClient('counter', 's1', res1 as ServerResponse)
    broadcaster.addClient('counter', 's2', res2 as ServerResponse)

    broadcaster.broadcast('counter', 'state', { count: 42 })

    expect(res1._written).toHaveLength(1)
    expect(res1._written[0]).toContain('event: state')
    expect(res1._written[0]).toContain('"count":42')
    expect(res2._written).toHaveLength(1)
  })

  it('broadcast does not send to clients of other stores', () => {
    const counterRes = mockRes()
    const cartRes = mockRes()
    broadcaster.addClient('counter', 's1', counterRes as ServerResponse)
    broadcaster.addClient('cart', 's2', cartRes as ServerResponse)

    broadcaster.broadcast('counter', 'state', { count: 1 })

    expect(counterRes._written).toHaveLength(1)
    expect(cartRes._written).toHaveLength(0)
  })

  it('removeClient removes a specific connection', () => {
    const res = mockRes()
    broadcaster.addClient('counter', 's1', res as ServerResponse)
    broadcaster.removeClient('counter', 's1')
    expect(broadcaster.connectionCount('counter')).toBe(0)
  })

  it('auto-removes client on response close event', () => {
    const res = mockRes()
    broadcaster.addClient('counter', 's1', res as ServerResponse)
    expect(broadcaster.connectionCount('counter')).toBe(1)

    res.emit('close')
    expect(broadcaster.connectionCount('counter')).toBe(0)
  })

  it('broadcastExcept sends to all except specified session', () => {
    const res1 = mockRes()
    const res2 = mockRes()
    const res3 = mockRes()
    broadcaster.addClient('counter', 's1', res1 as ServerResponse)
    broadcaster.addClient('counter', 's2', res2 as ServerResponse)
    broadcaster.addClient('counter', 's3', res3 as ServerResponse)

    broadcaster.broadcastExcept('counter', 's2', 'state', { count: 10 })

    expect(res1._written).toHaveLength(1)
    expect(res2._written).toHaveLength(0)
    expect(res3._written).toHaveLength(1)
  })

  it('broadcast formats SSE correctly with event and data lines', () => {
    const res = mockRes()
    broadcaster.addClient('counter', 's1', res as ServerResponse)

    broadcaster.broadcast('counter', 'confirmed', { mutationId: 3 })

    const written = res._written[0]!
    expect(written).toMatch(/^event: confirmed\n/)
    expect(written).toMatch(/data: \{.*"mutationId":3.*\}\n\n/)
  })

  it('multiple stores tracked independently', () => {
    const r1 = mockRes()
    const r2 = mockRes()
    broadcaster.addClient('counter', 's1', r1 as ServerResponse)
    broadcaster.addClient('cart', 's2', r2 as ServerResponse)

    expect(broadcaster.connectionCount('counter')).toBe(1)
    expect(broadcaster.connectionCount('cart')).toBe(1)

    broadcaster.removeClient('counter', 's1')
    expect(broadcaster.connectionCount('counter')).toBe(0)
    expect(broadcaster.connectionCount('cart')).toBe(1)
  })
})
