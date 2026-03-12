import { describe, it, expect, vi } from 'vitest'
import { fleetSitesHandler, fleetComparisonHandler } from '../server/fleet-routes.js'
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
