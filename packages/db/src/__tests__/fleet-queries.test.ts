import { describe, it, expect, vi } from 'vitest'
import { getFleetSites, getFleetComparison, getFleetSiteHistory } from '../fleet-queries.js'
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
