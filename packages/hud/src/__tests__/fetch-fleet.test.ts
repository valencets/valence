import { describe, it, expect, vi, afterEach } from 'vitest'
import { fetchFleetSites, fetchFleetComparison, fetchFleetAggregates } from '../data/fetch-fleet.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('fetchFleetSites', () => {
  it('is a function', () => {
    expect(typeof fetchFleetSites).toBe('function')
  })

  it('returns a ResultAsync', () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      new Response(JSON.stringify([]), { status: 200 })
    )
    const result = fetchFleetSites('')
    expect(typeof result.andThen).toBe('function')
  })

  it('fetches from /api/fleet/sites', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      expect(String(input)).toContain('/api/fleet/sites')
      return new Response(JSON.stringify([
        { site_id: 'site_acme', business_type: 'barbershop', status: 'healthy', session_count: 247 }
      ]))
    })
    const result = await fetchFleetSites('')
    expect(result.isOk()).toBe(true)
  })

  it('returns Err on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network error')
    })
    const result = await fetchFleetSites('')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('FETCH_FAILED')
  })
})

describe('fetchFleetAggregates', () => {
  it('is a function', () => {
    expect(typeof fetchFleetAggregates).toBe('function')
  })

  it('fetches from /api/fleet/aggregates', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      expect(String(input)).toContain('/api/fleet/aggregates')
      return new Response(JSON.stringify({
        total_sites: 5,
        total_sessions: 1200,
        total_conversions: 85
      }))
    })
    const result = await fetchFleetAggregates('')
    expect(result.isOk()).toBe(true)
    const data = result._unsafeUnwrap()
    expect(data.total_sites).toBe(5)
    expect(data.total_sessions).toBe(1200)
    expect(data.total_conversions).toBe(85)
  })

  it('returns Err on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network error')
    })
    const result = await fetchFleetAggregates('')
    expect(result.isErr()).toBe(true)
    expect(result._unsafeUnwrapErr().code).toBe('FETCH_FAILED')
  })
})

describe('fetchFleetComparison', () => {
  it('is a function', () => {
    expect(typeof fetchFleetComparison).toBe('function')
  })

  it('fetches from /api/fleet/compare with type param', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      expect(String(input)).toContain('/api/fleet/compare?type=barbershop')
      return new Response(JSON.stringify([]))
    })
    const result = await fetchFleetComparison('', 'barbershop')
    expect(result.isOk()).toBe(true)
  })

  it('returns Err on fetch failure', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () => {
      throw new Error('Network error')
    })
    const result = await fetchFleetComparison('', 'barbershop')
    expect(result.isErr()).toBe(true)
  })
})
