import { describe, it, expect, vi } from 'vitest'
import {
  breakdownPagesHandler,
  breakdownSourcesHandler,
  breakdownActionsHandler
} from '../server/breakdown-routes.js'

function mockRes (): { writeHead: ReturnType<typeof vi.fn>; end: ReturnType<typeof vi.fn>; body: () => unknown } {
  let raw = ''
  const res = {
    writeHead: vi.fn(),
    end: vi.fn((data: string) => { raw = data })
  }
  return { ...res, body: () => JSON.parse(raw) }
}

function mockPool (rows: unknown[]): unknown {
  return { sql: vi.fn(() => Promise.resolve(rows)) }
}

const mockReq = {
  url: '/api/breakdowns/pages?period=7D',
  headers: { host: 'localhost' }
}

const mockConfig = {
  siteId: 'site_studio'
}

const sampleRows = [{
  top_pages: [{ path: '/', count: 500 }, { path: '/about', count: 120 }],
  top_referrers: [{ referrer: 'google.com', count: 200 }, { referrer: '', count: 100 }],
  intent_counts: { CLICK: 300, LEAD_PHONE: 10, LEAD_EMAIL: 5, SCROLL: 50 }
}]

describe('breakdownPagesHandler', () => {
  it('is a function', () => {
    expect(typeof breakdownPagesHandler).toBe('function')
  })

  it('returns JSON with pages array', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(sampleRows), config: mockConfig }
    await breakdownPagesHandler(mockReq as never, res as never, ctx as never)
    const body = res.body() as { pages: unknown[] }
    expect(body.pages).toBeDefined()
    expect(Array.isArray(body.pages)).toBe(true)
  })

  it('returns empty pages for no data', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool([]), config: mockConfig }
    await breakdownPagesHandler(mockReq as never, res as never, ctx as never)
    const body = res.body() as { pages: unknown[] }
    expect(body.pages).toEqual([])
  })
})

describe('breakdownSourcesHandler', () => {
  it('is a function', () => {
    expect(typeof breakdownSourcesHandler).toBe('function')
  })

  it('returns JSON with sources array', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(sampleRows), config: mockConfig }
    const req = { url: '/api/breakdowns/sources?period=7D', headers: { host: 'localhost' } }
    await breakdownSourcesHandler(req as never, res as never, ctx as never)
    const body = res.body() as { sources: unknown[] }
    expect(body.sources).toBeDefined()
    expect(Array.isArray(body.sources)).toBe(true)
  })

  it('classifies referrers into categories', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(sampleRows), config: mockConfig }
    const req = { url: '/api/breakdowns/sources?period=7D', headers: { host: 'localhost' } }
    await breakdownSourcesHandler(req as never, res as never, ctx as never)
    const body = res.body() as { sources: { category: string; count: number; percent: number }[] }
    const categories = body.sources.map(s => s.category)
    expect(categories).toContain('Search')
  })
})

describe('breakdownActionsHandler', () => {
  it('is a function', () => {
    expect(typeof breakdownActionsHandler).toBe('function')
  })

  it('returns JSON with actions array', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(sampleRows), config: mockConfig }
    const req = { url: '/api/breakdowns/actions?period=7D', headers: { host: 'localhost' } }
    await breakdownActionsHandler(req as never, res as never, ctx as never)
    const body = res.body() as { actions: unknown[] }
    expect(body.actions).toBeDefined()
    expect(Array.isArray(body.actions)).toBe(true)
  })

  it('filters to only lead action types', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(sampleRows), config: mockConfig }
    const req = { url: '/api/breakdowns/actions?period=7D', headers: { host: 'localhost' } }
    await breakdownActionsHandler(req as never, res as never, ctx as never)
    const body = res.body() as { actions: { action: string; count: number }[] }
    const actionNames = body.actions.map(a => a.action)
    for (const name of actionNames) {
      expect(name.startsWith('LEAD_')).toBe(true)
    }
  })

  it('returns empty actions for no data', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool([]), config: mockConfig }
    const req = { url: '/api/breakdowns/actions?period=7D', headers: { host: 'localhost' } }
    await breakdownActionsHandler(req as never, res as never, ctx as never)
    const body = res.body() as { actions: unknown[] }
    expect(body.actions).toEqual([])
  })
})
