import { describe, it, expect, vi } from 'vitest'
import { getSites, getSiteBySlug, upsertSite } from '../site-queries.js'
import type { SiteRow } from '../site-types.js'
import type { DbPool } from '../connection.js'

function makeMockPool (returnValue: unknown = []): DbPool {
  const sql = vi.fn(() => Promise.resolve(returnValue)) as unknown as DbPool['sql']
  return { sql }
}

function makeErrorPool (error: Error): DbPool {
  const sql = vi.fn(() => Promise.reject(error)) as unknown as DbPool['sql']
  return { sql }
}

const mockSite: SiteRow = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  name: 'Inertia Studio',
  slug: 'studio',
  vertical: 'studio',
  sub_vertical: null,
  location: null,
  tier: 'managed',
  registered_at: new Date('2026-03-01'),
  appliance_hardware: 'N100-16GB',
  lead_action_schema: null
}

describe('getSites', () => {
  it('is a function', () => {
    expect(typeof getSites).toBe('function')
  })

  it('returns empty array when no sites', async () => {
    const pool = makeMockPool([])
    const result = await getSites(pool)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toEqual([])
  })

  it('returns site rows', async () => {
    const pool = makeMockPool([mockSite])
    const result = await getSites(pool)
    expect(result.isOk()).toBe(true)
    const sites = result._unsafeUnwrap()
    expect(sites).toHaveLength(1)
    expect(sites[0].slug).toBe('studio')
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getSites(pool)
    expect(result.isErr()).toBe(true)
  })
})

describe('getSiteBySlug', () => {
  it('is a function', () => {
    expect(typeof getSiteBySlug).toBe('function')
  })

  it('returns null when site not found', async () => {
    const pool = makeMockPool([])
    const result = await getSiteBySlug(pool, 'nonexistent')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toBeNull()
  })

  it('returns site row when found', async () => {
    const pool = makeMockPool([mockSite])
    const result = await getSiteBySlug(pool, 'studio')
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()?.name).toBe('Inertia Studio')
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await getSiteBySlug(pool, 'studio')
    expect(result.isErr()).toBe(true)
  })
})

describe('upsertSite', () => {
  it('is a function', () => {
    expect(typeof upsertSite).toBe('function')
  })

  it('returns upserted site row', async () => {
    const pool = makeMockPool([mockSite])
    const result = await upsertSite(pool, {
      name: 'Inertia Studio',
      slug: 'studio',
      vertical: 'studio',
      sub_vertical: null,
      location: null,
      tier: 'managed',
      appliance_hardware: 'N100-16GB',
      lead_action_schema: null
    })
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap().slug).toBe('studio')
  })

  it('returns error when INSERT returns no rows', async () => {
    const pool = makeMockPool([])
    const result = await upsertSite(pool, {
      name: 'Test',
      slug: 'test',
      vertical: 'other',
      sub_vertical: null,
      location: null,
      tier: 'build_only',
      appliance_hardware: null,
      lead_action_schema: null
    })
    expect(result.isErr()).toBe(true)
  })

  it('returns error on database failure', async () => {
    const pool = makeErrorPool(new Error('connection refused'))
    const result = await upsertSite(pool, {
      name: 'Test',
      slug: 'test',
      vertical: 'other',
      sub_vertical: null,
      location: null,
      tier: 'build_only',
      appliance_hardware: null,
      lead_action_schema: null
    })
    expect(result.isErr()).toBe(true)
  })
})
