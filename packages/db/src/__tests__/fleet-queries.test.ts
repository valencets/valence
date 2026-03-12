import { describe, it, expect, vi } from 'vitest'
import { getFleetSites, getFleetComparison, getFleetSiteHistory, getFleetAggregates, getFleetAlerts } from '../fleet-queries.js'
import type { FleetFilter, FleetSort } from '../fleet-queries.js'
import type { DbPool } from '../connection.js'

function makeMockPool (returnValue: unknown = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

function makeErrorPool (error: Error): DbPool {
  const sql = vi.fn(() => Promise.reject(error)) as unknown as DbPool['sql']
  return { sql }
}

describe('getFleetSites', () => {
  it('is a function', () => {
    expect(typeof getFleetSites).toBe('function')
  })

  it('returns a ResultAsync', () => {
    const pool = makeMockPool()
    const result = getFleetSites(pool)
    expect(typeof result.andThen).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getFleetSites(pool)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getFleetSites(pool)
    expect(result.isErr()).toBe(true)
  })

  it('marks site as healthy when synced_at is recent', async () => {
    const pool = makeMockPool([{
      site_id: 'studio',
      business_type: 'other',
      date: new Date(),
      session_count: 5,
      pageview_count: 10,
      conversion_count: 1,
      synced_at: new Date()
    }])
    const result = await getFleetSites(pool)
    expect(result.isOk()).toBe(true)
    const sites = result._unsafeUnwrap()
    expect(sites[0]?.status).toBe('healthy')
  })

  it('marks site as offline when synced_at is null', async () => {
    const pool = makeMockPool([{
      site_id: 'studio',
      business_type: 'other',
      date: new Date(),
      session_count: 5,
      pageview_count: 10,
      conversion_count: 1,
      synced_at: null
    }])
    const result = await getFleetSites(pool)
    expect(result.isOk()).toBe(true)
    const sites = result._unsafeUnwrap()
    expect(sites[0]?.status).toBe('offline')
  })
})

describe('getFleetSites with filters', () => {
  it('accepts optional filter parameter', async () => {
    const pool = makeMockPool([])
    const filter: FleetFilter = { vertical: 'restaurant' }
    const result = await getFleetSites(pool, filter)
    expect(result.isOk()).toBe(true)
  })

  it('accepts optional sort parameter', async () => {
    const pool = makeMockPool([])
    const sort: FleetSort = { column: 'session_count', order: 'desc' }
    const result = await getFleetSites(pool, undefined, sort)
    expect(result.isOk()).toBe(true)
  })

  it('accepts filter and sort together', async () => {
    const pool = makeMockPool([])
    const filter: FleetFilter = { tier: 'managed' }
    const sort: FleetSort = { column: 'session_count', order: 'asc' }
    const result = await getFleetSites(pool, filter, sort)
    expect(result.isOk()).toBe(true)
  })
})

describe('getFleetAggregates', () => {
  it('is a function', () => {
    expect(typeof getFleetAggregates).toBe('function')
  })

  it('returns aggregate totals', async () => {
    const pool = makeMockPool([{
      total_sites: 5,
      total_sessions: 1200,
      total_conversions: 85
    }])
    const result = await getFleetAggregates(pool)
    expect(result.isOk()).toBe(true)
    const agg = result._unsafeUnwrap()
    expect(agg.total_sites).toBe(5)
    expect(agg.total_sessions).toBe(1200)
    expect(agg.total_conversions).toBe(85)
  })

  it('returns zeros when no data', async () => {
    const pool = makeMockPool([])
    const result = await getFleetAggregates(pool)
    expect(result.isOk()).toBe(true)
    const agg = result._unsafeUnwrap()
    expect(agg.total_sites).toBe(0)
    expect(agg.total_sessions).toBe(0)
    expect(agg.total_conversions).toBe(0)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getFleetAggregates(pool)
    expect(result.isErr()).toBe(true)
  })
})

describe('getFleetAlerts', () => {
  it('is a function', () => {
    expect(typeof getFleetAlerts).toBe('function')
  })

  it('returns offline sites as alerts', async () => {
    const pool = makeMockPool([{
      site_id: 'site_acme',
      synced_at: null,
      rejection_count: 0,
      conversion_count: 0,
      tier: 'managed'
    }])
    const result = await getFleetAlerts(pool)
    expect(result.isOk()).toBe(true)
    const alerts = result._unsafeUnwrap()
    expect(alerts.length).toBeGreaterThanOrEqual(1)
    expect(alerts[0].severity).toBe('red')
    expect(alerts[0].type).toBe('offline')
  })

  it('returns empty array when no alerts', async () => {
    const pool = makeMockPool([])
    const result = await getFleetAlerts(pool)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getFleetAlerts(pool)
    expect(result.isErr()).toBe(true)
  })
})

describe('getFleetComparison', () => {
  it('is a function', () => {
    expect(typeof getFleetComparison).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getFleetComparison(pool, 'barbershop')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getFleetComparison(pool, 'barbershop')
    expect(result.isErr()).toBe(true)
  })
})

describe('getFleetSiteHistory', () => {
  it('is a function', () => {
    expect(typeof getFleetSiteHistory).toBe('function')
  })

  it('returns empty array for no data', async () => {
    const pool = makeMockPool([])
    const result = await getFleetSiteHistory(pool, 'site_acme', 30)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getFleetSiteHistory(pool, 'site_acme', 30)
    expect(result.isErr()).toBe(true)
  })
})
