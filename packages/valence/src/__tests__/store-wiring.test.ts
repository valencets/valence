import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { field } from '@valencets/store'
import type { StoreInput } from '@valencets/store'
import { registerStoreRoutesOnServer } from '../store-wiring.js'
import type { RouteHandler } from '../define-config.js'

interface CapturedResponse {
  statusCode: number
  headers: { [key: string]: string }
  body: string
  written: string[]
}

function mockReq (options?: { cookie?: string; body?: string }): IncomingMessage {
  const emitter = new EventEmitter()
  const req = Object.assign(emitter, {
    headers: { cookie: options?.cookie ?? 'session_id=sess-a' },
    method: 'POST'
  })
  if (options?.body !== undefined) {
    const payload = options.body
    // Deliver body on next tick — the handler subscribes synchronously
    setTimeout(() => {
      emitter.emit('data', Buffer.from(payload))
      emitter.emit('end')
    }, 0)
  } else {
    setTimeout(() => { emitter.emit('end') }, 0)
  }
  return req as unknown as IncomingMessage
}

function mockRes (): ServerResponse & { _captured: CapturedResponse } {
  const emitter = new EventEmitter()
  const captured: CapturedResponse = { statusCode: 0, headers: {}, body: '', written: [] }
  const res = Object.assign(emitter, {
    _captured: captured,
    writeHead (status: number, headers?: { [key: string]: string }) {
      captured.statusCode = status
      if (headers) Object.assign(captured.headers, headers)
      return res
    },
    setHeader (name: string, value: string) { captured.headers[name] = value },
    flushHeaders () {},
    write (chunk: string) { captured.written.push(chunk); return true },
    end (body?: string) { if (body) captured.body = body }
  })
  return res as unknown as ServerResponse & { _captured: CapturedResponse }
}

function collectRoutes (): { registerRoute: (method: string, path: string, handler: RouteHandler) => void; routes: Map<string, RouteHandler> } {
  const routes = new Map<string, RouteHandler>()
  return {
    registerRoute: (method, path, handler) => { routes.set(`${method} ${path}`, handler) },
    routes
  }
}

function counterStore (overrides?: Partial<StoreInput>): StoreInput {
  return {
    slug: 'counter',
    scope: 'session',
    fields: [field.number({ name: 'count', default: 0 })],
    mutations: {
      increment: {
        input: [field.number({ name: 'amount' })],
        server: async ({ state, input }) => {
          state.count = (state.count as number) + (input.amount as number)
        }
      }
    },
    ...overrides
  }
}

async function postMutation (
  routes: Map<string, RouteHandler>,
  slug: string,
  mutation: string,
  body: string,
  cookie?: string
): Promise<CapturedResponse> {
  const handler = routes.get(`POST /store/${slug}/:mutation`)!
  const req = mockReq({ body, ...(cookie !== undefined ? { cookie } : {}) })
  const res = mockRes()
  await handler(req, res, { mutation })
  return res._captured
}

describe('registerStoreRoutesOnServer', () => {
  it('requires a session on every route', async () => {
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute)

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":1}}', '')
    expect(captured.statusCode).toBe(401)
  })

  it('echoes the client mutationId as confirmedId through the handler chain', async () => {
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute)

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":2},"mutationId":7}')
    expect(captured.statusCode).toBe(200)
    const parsed = JSON.parse(captured.body)
    expect(parsed.ok).toBe(true)
    expect(parsed.state.count).toBe(2)
    expect(parsed.confirmedId).toBe(7)
  })

  it('returns 404 for unknown mutation names', async () => {
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute)

    const captured = await postMutation(routes, 'counter', 'nonexistent', '{"args":{}}')
    expect(captured.statusCode).toBe(404)
  })

  it('returns 400 for validation failures', async () => {
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute)

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":"not-a-number"}}')
    expect(captured.statusCode).toBe(400)
  })

  it('rejects oversized request bodies with 413', async () => {
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute)

    const huge = JSON.stringify({ args: { amount: 1 }, padding: 'x'.repeat(300_000) })
    const captured = await postMutation(routes, 'counter', 'increment', huge)
    expect(captured.statusCode).toBe(413)
  })

  it('passes the configured pool through to mutation server fns', async () => {
    const query = vi.fn(async () => [{ price: 9.99 }])
    const { registerRoute, routes } = collectRoutes()

    const storeInput = counterStore({
      mutations: {
        lookup: {
          input: [],
          server: async ({ state, pool }) => {
            const rows = await pool.query('SELECT price FROM products')
            state.count = (rows[0] as { price: number }).price
          }
        }
      }
    })
    registerStoreRoutesOnServer([storeInput], registerRoute, { pool: { query } })

    const captured = await postMutation(routes, 'counter', 'lookup', '{"args":{}}')
    expect(captured.statusCode).toBe(200)
    expect(query).toHaveBeenCalledWith('SELECT price FROM products')
    expect(JSON.parse(captured.body).state.count).toBe(9.99)
  })

  it('registers no server routes for page-scoped stores', () => {
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore({ scope: 'page' })], registerRoute)

    expect(routes.size).toBe(0)
  })

  it('logs and skips invalid store definitions instead of silently dropping them', () => {
    const log = vi.fn()
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore({ slug: 'Bad Slug!' })], registerRoute, { log })

    expect(routes.size).toBe(0)
    expect(log).toHaveBeenCalled()
    const message = String(log.mock.calls[0]![0])
    expect(message).toMatch(/Bad Slug!|invalid|error/i)
  })

  it('includes the rendered fragment in the mutator POST response for fragment stores', async () => {
    const { registerRoute, routes } = collectRoutes()
    const storeInput = counterStore({
      fragment: (state) => `<span>${state.count as number}</span>`
    })
    registerStoreRoutesOnServer([storeInput], registerRoute)

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":3},"mutationId":1}')
    const parsed = JSON.parse(captured.body)
    expect(parsed.fragment).toBeDefined()
    expect(parsed.fragment.selector).toBe('[data-store="counter"]')
    expect(parsed.fragment.html).toContain('<span>3</span>')
  })

  it('sends fragment SSE events to the mutating session tabs only for session scope', async () => {
    const { registerRoute, routes } = collectRoutes()
    const storeInput = counterStore({
      fragment: (state) => `<span>${state.count as number}</span>`
    })
    registerStoreRoutesOnServer([storeInput], registerRoute)

    // Same-session second tab + a different-session observer
    const eventsHandler = routes.get('GET /store/counter/events')!
    const sameTab = mockRes()
    const otherSession = mockRes()
    await eventsHandler(mockReq({ cookie: 'session_id=sess-a' }), sameTab, {})
    await eventsHandler(mockReq({ cookie: 'session_id=sess-b' }), otherSession, {})

    await postMutation(routes, 'counter', 'increment', '{"args":{"amount":1}}', 'session_id=sess-a')

    const sameTabFrames = sameTab._captured.written.join('')
    const otherFrames = otherSession._captured.written.join('')
    expect(sameTabFrames).toContain('event: fragment')
    expect(otherFrames).not.toContain('event: fragment')
    expect(otherFrames).not.toContain('event: state')
  })
})
