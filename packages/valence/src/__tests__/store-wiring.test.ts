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

describe('session verification (secret configured)', () => {
  const SECRET = 'wiring-test-secret'

  async function importSession () {
    return await import('../store-session.js')
  }

  it('rejects unsigned session ids with 401', async () => {
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET })

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":1}}', 'session_id=plain-forged-id')
    expect(captured.statusCode).toBe(401)
  })

  it('accepts signed session ids and isolates state between them', async () => {
    const { mintSignedSessionId } = await importSession()
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET })

    const tokenA = mintSignedSessionId(SECRET)
    const tokenB = mintSignedSessionId(SECRET)

    const first = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":4}}', `session_id=${tokenA}`)
    expect(first.statusCode).toBe(200)
    expect(JSON.parse(first.body).state.count).toBe(4)

    const other = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":1}}', `session_id=${tokenB}`)
    expect(JSON.parse(other.body).state.count).toBe(1)
  })

  it('mints a signed session and sets the cookie when none is present', async () => {
    const { verifySignedSessionId } = await importSession()
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET })

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":2}}', '')
    expect(captured.statusCode).toBe(200)

    const setCookie = captured.headers['Set-Cookie'] ?? captured.headers['set-cookie']
    expect(setCookie).toBeDefined()
    const token = String(setCookie).match(/session_id=([^;]+)/)?.[1]
    expect(token).toBeDefined()
    expect(verifySignedSessionId(SECRET, token!)).not.toBeNull()
  })

  it('resolves userId from a cms_session cookie via the validator', async () => {
    let seenUserId: string | undefined
    const validateCmsSession = vi.fn(async () => 'user-77')
    const { registerRoute, routes } = collectRoutes()

    const storeInput = counterStore({
      scope: 'user',
      mutations: {
        record: {
          input: [],
          server: async ({ session }) => { seenUserId = session.userId }
        }
      }
    })
    registerStoreRoutesOnServer([storeInput], registerRoute, { secret: SECRET, validateCmsSession })

    const captured = await postMutation(routes, 'counter', 'record', '{"args":{}}', 'cms_session=11111111-2222-3333-4444-555555555555')
    expect(captured.statusCode).toBe(200)
    expect(validateCmsSession).toHaveBeenCalledWith('11111111-2222-3333-4444-555555555555')
    expect(seenUserId).toBe('user-77')
  })

  it('falls back to minting an anonymous session when the cms session is invalid', async () => {
    const validateCmsSession = vi.fn(async () => null)
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET, validateCmsSession })

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":1}}', 'cms_session=stale-after-logout')
    expect(captured.statusCode).toBe(200)
    const setCookie = captured.headers['Set-Cookie'] ?? captured.headers['set-cookie']
    expect(setCookie).toBeDefined()
  })

  it('rejects anonymous identities on user-scoped stores with 403', async () => {
    const { mintSignedSessionId } = await importSession()
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore({ scope: 'user' })], registerRoute, { secret: SECRET })

    const token = mintSignedSessionId(SECRET)
    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":1}}', `session_id=${token}`)
    expect(captured.statusCode).toBe(403)
  })
})

describe('user-scope postgres persistence wiring', () => {
  const SECRET = 'wiring-test-secret'

  it('ensures the store_states table and persists user state through the pool', async () => {
    const rows = new Map<string, { [key: string]: unknown }>()
    const query = vi.fn(async (sql: string, ...params: string[]) => {
      if (sql.startsWith('CREATE TABLE')) return []
      if (sql.startsWith('INSERT')) {
        rows.set(`${params[0]}|${params[1]}`, JSON.parse(params[2]!) as { [key: string]: unknown })
        return []
      }
      const row = rows.get(`${params[0]}|${params[1]}`)
      return row ? [{ state: row }] : []
    })
    const validateCmsSession = vi.fn(async () => 'user-9')
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore({ scope: 'user' })], registerRoute, {
      secret: SECRET,
      validateCmsSession,
      pool: { query }
    })

    const captured = await postMutation(routes, 'counter', 'increment', '{"args":{"amount":6}}', 'cms_session=cms-token')
    expect(captured.statusCode).toBe(200)
    expect(JSON.parse(captured.body).state.count).toBe(6)

    const sqlCalls = query.mock.calls.map(call => String(call[0]))
    expect(sqlCalls.some(sql => sql.startsWith('CREATE TABLE IF NOT EXISTS'))).toBe(true)
    expect(sqlCalls.some(sql => sql.includes('INSERT INTO store_states'))).toBe(true)
    expect(rows.has('counter|user:user-9')).toBe(true)
  })

  it('session-scoped stores stay in memory — no store_states traffic', async () => {
    const query = vi.fn(async () => [])
    const { registerRoute, routes } = collectRoutes()
    registerStoreRoutesOnServer([counterStore({ scope: 'session' })], registerRoute, { pool: { query } })

    await postMutation(routes, 'counter', 'increment', '{"args":{"amount":1}}')

    const storeStateCalls = query.mock.calls.filter(call => String(call[0]).includes('store_states'))
    expect(storeStateCalls).toHaveLength(0)
  })
})

describe('hydration auto-injection', () => {
  const SECRET = 'wiring-test-secret'

  async function mintCookie (): Promise<string> {
    const { mintSignedSessionId } = await import('../store-session.js')
    return `session_id=${mintSignedSessionId(SECRET)}`
  }

  function pageReq (cookie: string): IncomingMessage {
    const emitter = new EventEmitter()
    return Object.assign(emitter, { headers: { cookie }, method: 'GET' }) as unknown as IncomingMessage
  }

  it('returns a hydrator that injects tags for stores referenced by data-store', async () => {
    const { registerRoute } = collectRoutes()
    const hydrator = registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET })
    expect(hydrator).toBeDefined()

    const cookie = await mintCookie()
    const html = '<html><body><div data-store="counter"></div></body></html>'
    const res = mockRes()

    const out = await hydrator!(pageReq(cookie), res, html)

    expect(out).toContain('data-store-hydrate="counter"')
    expect(out).toContain('"count":0')
    expect(out.indexOf('data-store-hydrate')).toBeLessThan(out.indexOf('</body>'))
  })

  it('leaves pages without store references untouched and mints no cookie', async () => {
    const { registerRoute } = collectRoutes()
    const hydrator = registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET })

    const html = '<html><body><p>plain page</p></body></html>'
    const res = mockRes()
    const out = await hydrator!(pageReq(''), res, html)

    expect(out).toBe(html)
    expect(res._captured.headers['Set-Cookie']).toBeUndefined()
  })

  it('mints the anonymous session cookie on first paint of a store page', async () => {
    const { registerRoute } = collectRoutes()
    const hydrator = registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET })

    const html = '<body><div data-store="counter"></div></body>'
    const res = mockRes()
    const out = await hydrator!(pageReq(''), res, html)

    expect(out).toContain('data-store-hydrate="counter"')
    expect(res._captured.headers['Set-Cookie']).toContain('session_id=')
  })

  it('skips user-scoped stores for anonymous identities', async () => {
    const { registerRoute } = collectRoutes()
    const hydrator = registerStoreRoutesOnServer([counterStore({ scope: 'user' })], registerRoute, { secret: SECRET })

    const cookie = await mintCookie()
    const html = '<body><div data-store="counter"></div></body>'
    const out = await hydrator!(pageReq(cookie), mockRes(), html)

    expect(out).not.toContain('data-store-hydrate')
  })

  it('reflects the session state already mutated through the POST route', async () => {
    const { registerRoute, routes } = collectRoutes()
    const hydrator = registerStoreRoutesOnServer([counterStore()], registerRoute, { secret: SECRET })

    const cookie = await mintCookie()
    await postMutation(routes, 'counter', 'increment', '{"args":{"amount":9}}', cookie)

    const html = '<body><div data-store="counter"></div></body>'
    const out = await hydrator!(pageReq(cookie), mockRes(), html)

    expect(out).toContain('"count":9')
  })
})
