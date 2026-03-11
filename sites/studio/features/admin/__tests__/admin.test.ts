import { describe, it, expect, vi } from 'vitest'
import { checkAuth } from '../server/auth-middleware.js'
import { renderHudPage } from '../templates/hud-page.js'
import { renderLoginForm } from '../templates/login-form.js'

describe('checkAuth', () => {
  it('returns ok for valid bearer token', () => {
    const result = checkAuth('Bearer test-token-123', 'test-token-123')
    expect(result.isOk()).toBe(true)
  })

  it('returns err for missing authorization', () => {
    const result = checkAuth(undefined, 'test-token-123')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('AUTH_FAILED')
  })

  it('returns err for wrong token', () => {
    const result = checkAuth('Bearer wrong-token', 'test-token-123')
    expect(result.isErr()).toBe(true)
  })

  it('returns err for non-bearer scheme', () => {
    const result = checkAuth('Basic dXNlcjpwYXNz', 'test-token-123')
    expect(result.isErr()).toBe(true)
  })

  it('returns err for empty token', () => {
    const result = checkAuth('Bearer ', 'test-token-123')
    expect(result.isErr()).toBe(true)
  })
})

describe('renderLoginForm', () => {
  it('renders a form with token input', () => {
    const html = renderLoginForm()
    expect(html).toContain('<form')
    expect(html).toContain('type="password"')
    expect(html).toContain('name="token"')
  })

  it('has a submit button', () => {
    const html = renderLoginForm()
    expect(html).toContain('type="submit"')
  })

  it('posts to /admin/hud', () => {
    const html = renderLoginForm()
    expect(html).toContain('action="/admin/hud"')
    expect(html).toContain('method="POST"')
  })
})

describe('renderHudPage', () => {
  it('returns HTML with hud-client-dashboard', () => {
    const html = renderHudPage(false)
    expect(html).toContain('hud-client-dashboard')
  })

  it('renders diagnostic dashboard when diagnostics flag is true', () => {
    const html = renderHudPage(true)
    expect(html).toContain('hud-diagnostic-dashboard')
  })

  it('includes summary API endpoints as data attributes', () => {
    const html = renderHudPage(false)
    expect(html).toContain('/api/summaries/sessions')
    expect(html).toContain('/api/summaries/events')
  })

  it('includes admin JS bundle script', () => {
    const html = renderHudPage(false)
    expect(html).toContain('/js/admin.js')
  })
})

describe('summary route handlers', () => {
  function mockRes (): { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; body: () => unknown } {
    let raw = ''
    const res = {
      writeHead: vi.fn(),
      end: vi.fn((data: string) => { raw = data })
    }
    return { ...res, body: () => JSON.parse(raw) }
  }

  function mockPool (rows: unknown[]): unknown {
    return { sql: async () => rows }
  }

  it('sessionSummaryHandler returns single object, not array', async () => {
    const { sessionSummaryHandler } = await import('../server/summary-routes.js')
    const row = {
      id: 1,
      period_start: new Date(),
      period_end: new Date(),
      total_sessions: 247,
      unique_referrers: 12,
      device_mobile: 100,
      device_desktop: 130,
      device_tablet: 17,
      created_at: new Date()
    }
    const res = mockRes()
    const ctx = { pool: mockPool([row]), config: {} }
    await sessionSummaryHandler({} as never, res as never, ctx as never)
    const body = res.body()
    expect(body).not.toBeInstanceOf(Array)
    expect(body).toHaveProperty('total_sessions', 247)
  })

  it('eventSummaryHandler returns single object, not array', async () => {
    const { eventSummaryHandler } = await import('../server/summary-routes.js')
    const row = {
      id: 1,
      period_start: new Date(),
      period_end: new Date(),
      event_category: 'CLICK',
      total_count: 1500,
      unique_sessions: 200,
      created_at: new Date()
    }
    const res = mockRes()
    const ctx = { pool: mockPool([row]), config: {} }
    await eventSummaryHandler({} as never, res as never, ctx as never)
    const body = res.body()
    expect(body).not.toBeInstanceOf(Array)
    expect(body).toHaveProperty('total_count', 1500)
  })

  it('conversionSummaryHandler returns single object, not array', async () => {
    const { conversionSummaryHandler } = await import('../server/summary-routes.js')
    const row = {
      id: 1,
      period_start: new Date(),
      period_end: new Date(),
      intent_type: 'INTENT_CALL',
      total_count: 45,
      top_sources: [{ referrer: 'google', count: 30 }],
      created_at: new Date()
    }
    const res = mockRes()
    const ctx = { pool: mockPool([row]), config: {} }
    await conversionSummaryHandler({} as never, res as never, ctx as never)
    const body = res.body()
    expect(body).not.toBeInstanceOf(Array)
    expect(body).toHaveProperty('total_count', 45)
  })

  it('ingestionHealthHandler returns single object, not array', async () => {
    const { ingestionHealthHandler } = await import('../server/summary-routes.js')
    const row = {
      id: 1,
      period_start: new Date(),
      payloads_accepted: 500,
      payloads_rejected: 3,
      avg_processing_ms: 12,
      buffer_saturation_pct: 0.05,
      created_at: new Date()
    }
    const res = mockRes()
    const ctx = { pool: mockPool([row]), config: {} }
    await ingestionHealthHandler({} as never, res as never, ctx as never)
    const body = res.body()
    expect(body).not.toBeInstanceOf(Array)
    expect(body).toHaveProperty('payloads_accepted', 500)
  })

  it('returns zero-value fallback when no rows exist', async () => {
    const { sessionSummaryHandler } = await import('../server/summary-routes.js')
    const res = mockRes()
    const ctx = { pool: mockPool([]), config: {} }
    await sessionSummaryHandler({} as never, res as never, ctx as never)
    const body = res.body() as Record<string, unknown>
    expect(body).not.toBeInstanceOf(Array)
    expect(body.total_sessions).toBe(0)
  })
})
