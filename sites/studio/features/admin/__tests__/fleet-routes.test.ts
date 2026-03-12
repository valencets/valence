import { describe, it, expect, vi } from 'vitest'
import { fleetSitesHandler, fleetComparisonHandler, fleetAggregatesHandler } from '../server/fleet-routes.js'
import { renderFleetPage } from '../templates/fleet-page.js'

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

describe('fleetSitesHandler', () => {
  it('is a function', () => {
    expect(typeof fleetSitesHandler).toBe('function')
  })

  it('returns JSON array', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool([]), config: {} }
    await fleetSitesHandler({} as never, res as never, ctx as never)
    const body = res.body()
    expect(Array.isArray(body)).toBe(true)
  })
})

describe('fleetComparisonHandler', () => {
  it('is a function', () => {
    expect(typeof fleetComparisonHandler).toBe('function')
  })

  it('returns JSON array', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool([]), config: {} }
    const req = { url: '/api/fleet/compare?type=barbershop', headers: { host: 'localhost' } }
    await fleetComparisonHandler(req as never, res as never, ctx as never)
    const body = res.body()
    expect(Array.isArray(body)).toBe(true)
  })
})

describe('fleetAggregatesHandler', () => {
  it('is a function', () => {
    expect(typeof fleetAggregatesHandler).toBe('function')
  })

  it('returns JSON with aggregate totals', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool([{ total_sites: 5, total_sessions: 1200, total_conversions: 85 }]), config: {} }
    await fleetAggregatesHandler({} as never, res as never, ctx as never)
    const body = res.body() as { total_sites: number; total_sessions: number; total_conversions: number }
    expect(body.total_sites).toBe(5)
  })

  it('returns zeros for no data', async () => {
    const res = mockRes()
    const ctx = { pool: mockPool([]), config: {} }
    await fleetAggregatesHandler({} as never, res as never, ctx as never)
    const body = res.body() as { total_sites: number }
    expect(body.total_sites).toBe(0)
  })
})

describe('renderFleetPage', () => {
  it('renders overview with hud-fleet-dashboard', () => {
    const html = renderFleetPage('overview')
    expect(html).toContain('hud-fleet-dashboard')
  })

  it('renders compare with hud-fleet-comparison', () => {
    const html = renderFleetPage('compare')
    expect(html).toContain('hud-fleet-comparison')
  })

  it('includes admin JS bundle', () => {
    const html = renderFleetPage('overview')
    expect(html).toContain('/js/admin.js')
  })
})
