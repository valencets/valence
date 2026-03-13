import { describe, it, expect, vi } from 'vitest'
import { trendHandler } from '../server/trend-routes.js'

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

const mockConfig = {
  siteId: 'site_studio'
}

const sampleRows = [
  { date: new Date('2026-03-01'), session_count: 20, pageview_count: 100, conversion_count: 5 },
  { date: new Date('2026-03-02'), session_count: 30, pageview_count: 150, conversion_count: 8 }
]

describe('trendHandler', () => {
  it('is a function', () => {
    expect(typeof trendHandler).toBe('function')
  })

  it('returns JSON with days array', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(sampleRows), config: mockConfig }
    const req = { url: '/api/summaries/trend?period=7D', headers: { host: 'localhost' } }
    await trendHandler(req as never, res as never, ctx as never)
    const body = res.body() as { days: unknown[] }
    expect(body.days).toBeDefined()
    expect(Array.isArray(body.days)).toBe(true)
  })

  it('each day has date, session_count, pageview_count, conversion_count', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool(sampleRows), config: mockConfig }
    const req = { url: '/api/summaries/trend?period=7D', headers: { host: 'localhost' } }
    await trendHandler(req as never, res as never, ctx as never)
    const body = res.body() as { days: { date: string; session_count: number; pageview_count: number; conversion_count: number }[] }
    expect(body.days).toHaveLength(2)
    expect(body.days[0].date).toBe('2026-03-01')
    expect(body.days[0].session_count).toBe(20)
    expect(body.days[0].pageview_count).toBe(100)
    expect(body.days[0].conversion_count).toBe(5)
  })

  it('returns empty days for no data', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool([]), config: mockConfig }
    const req = { url: '/api/summaries/trend?period=7D', headers: { host: 'localhost' } }
    await trendHandler(req as never, res as never, ctx as never)
    const body = res.body() as { days: unknown[] }
    expect(body.days).toEqual([])
  })
})
