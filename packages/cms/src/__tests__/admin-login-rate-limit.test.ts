import { describe, it, expect, vi } from 'vitest'
import { createAdminRoutes } from '../admin/admin-routes.js'
import { createCollectionRegistry } from '../schema/registry.js'
import { collection } from '../schema/collection.js'
import { field } from '../schema/fields.js'
import { makeMockPool } from './test-helpers.js'

function makeUsersCollection () {
  return collection({
    slug: 'users',
    auth: true,
    fields: [field.text({ name: 'name' })]
  })
}

function makeMockLoginReq (body: string, remoteAddress: string = '127.0.0.1'): Record<string, unknown> {
  const req = {
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie: '' },
    url: '/admin/login',
    method: 'POST',
    socket: { remoteAddress },
    on: vi.fn((event: string, cb: (data?: Buffer) => void) => {
      if (event === 'data') cb(Buffer.from(body))
      if (event === 'end') cb()
      return req
    }),
    removeAllListeners: vi.fn(() => req)
  }
  return req
}

function makeMockRes (): { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; setHeader: ReturnType<typeof vi.fn>; body: string } {
  const res = {
    writeHead: vi.fn(),
    end: vi.fn((data?: string) => { res.body = data ?? '' }),
    setHeader: vi.fn(),
    body: ''
  }
  return res
}

function makeMockGetReq (): Record<string, unknown> {
  return {
    headers: { cookie: '' },
    url: '/admin/login',
    method: 'GET'
  }
}

/** Calls GET /admin/login to obtain a fresh CSRF token from the rendered form. */
async function getCsrfToken (routes: Map<string, { GET?: Function; POST?: Function }>): Promise<string> {
  const handler = routes.get('/admin/login')?.GET
  const req = makeMockGetReq()
  const res = makeMockRes()
  await handler!(req as never, res as never, {})
  const match = res.body.match(/name="_csrf"\s+value="([^"]+)"/)
  if (!match) throw new Error('Could not extract CSRF token from login page')
  return match[1]
}

describe('admin login rate limiting', () => {
  it('returns 429 on the 6th failed login attempt from the same IP', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeUsersCollection())
    // Pool returns empty user rows (no user found) so login always fails
    const pool = makeMockPool([])
    const routes = createAdminRoutes(pool, registry)

    // Make 5 failed login attempts (each needs a fresh CSRF token)
    for (let i = 0; i < 5; i++) {
      const token = await getCsrfToken(routes)
      const body = `email=attacker%40test.com&password=wrong&_csrf=${token}`
      const req = makeMockLoginReq(body)
      const res = makeMockRes()
      await routes.get('/admin/login')!.POST!(req as never, res as never, {})
      // First 5 should NOT be 429
      expect(res.writeHead).not.toHaveBeenCalledWith(429)
    }

    // 6th attempt should be rate limited
    const token = await getCsrfToken(routes)
    const body = `email=attacker%40test.com&password=wrong&_csrf=${token}`
    const req = makeMockLoginReq(body)
    const res = makeMockRes()
    await routes.get('/admin/login')!.POST!(req as never, res as never, {})
    expect(res.writeHead).toHaveBeenCalledWith(429)
    expect(res.body).toContain('Too many login attempts')
  })

  it('allows exactly 5 attempts before blocking', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeUsersCollection())
    const pool = makeMockPool([])
    const routes = createAdminRoutes(pool, registry)

    // Attempts 1-4 should all pass through to login logic (return 401, not 429)
    for (let i = 0; i < 4; i++) {
      const token = await getCsrfToken(routes)
      const body = `email=test%40test.com&password=wrong&_csrf=${token}`
      const req = makeMockLoginReq(body)
      const res = makeMockRes()
      await routes.get('/admin/login')!.POST!(req as never, res as never, {})
      expect(res.writeHead).not.toHaveBeenCalledWith(429)
    }

    // 5th attempt is the last allowed — still not rate limited
    const token5 = await getCsrfToken(routes)
    const body5 = `email=test%40test.com&password=wrong&_csrf=${token5}`
    const req5 = makeMockLoginReq(body5)
    const res5 = makeMockRes()
    await routes.get('/admin/login')!.POST!(req5 as never, res5 as never, {})
    expect(res5.writeHead).not.toHaveBeenCalledWith(429)

    // 6th attempt crosses the threshold
    const token6 = await getCsrfToken(routes)
    const body6 = `email=test%40test.com&password=wrong&_csrf=${token6}`
    const req6 = makeMockLoginReq(body6)
    const res6 = makeMockRes()
    await routes.get('/admin/login')!.POST!(req6 as never, res6 as never, {})
    expect(res6.writeHead).toHaveBeenCalledWith(429)
  })

  it('rate limits per-IP, not globally', async () => {
    const registry = createCollectionRegistry()
    registry.register(makeUsersCollection())
    const pool = makeMockPool([])
    const routes = createAdminRoutes(pool, registry)

    // Exhaust rate limit for IP 10.0.0.1
    for (let i = 0; i < 5; i++) {
      const token = await getCsrfToken(routes)
      const body = `email=attacker%40test.com&password=wrong&_csrf=${token}`
      const req = makeMockLoginReq(body, '10.0.0.1')
      const res = makeMockRes()
      await routes.get('/admin/login')!.POST!(req as never, res as never, {})
    }

    // 6th from same IP should be rate limited
    const tokenBlocked = await getCsrfToken(routes)
    const bodyBlocked = `email=attacker%40test.com&password=wrong&_csrf=${tokenBlocked}`
    const reqBlocked = makeMockLoginReq(bodyBlocked, '10.0.0.1')
    const resBlocked = makeMockRes()
    await routes.get('/admin/login')!.POST!(reqBlocked as never, resBlocked as never, {})
    expect(resBlocked.writeHead).toHaveBeenCalledWith(429)

    // Different IP should NOT be rate limited
    const tokenOk = await getCsrfToken(routes)
    const bodyOk = `email=attacker%40test.com&password=wrong&_csrf=${tokenOk}`
    const reqOk = makeMockLoginReq(bodyOk, '10.0.0.2')
    const resOk = makeMockRes()
    await routes.get('/admin/login')!.POST!(reqOk as never, resOk as never, {})
    expect(resOk.writeHead).not.toHaveBeenCalledWith(429)
  })
})
