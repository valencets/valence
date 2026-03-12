import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  fetchTopPages,
  fetchTrafficSources,
  fetchLeadActions
} from '../data/fetch-breakdowns.js'
import type { TopPagesData, TrafficSourcesData, LeadActionsData } from '../types.js'

const BASE_URL = 'https://api.example.com'

const mockTopPages: TopPagesData = {
  pages: [
    { path: '/', count: 500 },
    { path: '/about', count: 120 }
  ]
}

const mockTrafficSources: TrafficSourcesData = {
  sources: [
    { category: 'Search', count: 120, percent: 60 },
    { category: 'Direct', count: 80, percent: 40 }
  ]
}

const mockLeadActions: LeadActionsData = {
  actions: [
    { action: 'LEAD_PHONE', count: 10 },
    { action: 'LEAD_EMAIL', count: 5 }
  ]
}

function mockFetchOk (data: unknown): void {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data)
  }))
}

function mockFetchFail (): void {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))
}

describe('fetchTopPages', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns Ok with top pages data on success', async () => {
    mockFetchOk(mockTopPages)
    const result = await fetchTopPages(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.pages).toHaveLength(2)
      expect(result.value.pages[0].path).toBe('/')
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchTopPages(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('passes period as query parameter', async () => {
    mockFetchOk(mockTopPages)
    await fetchTopPages(BASE_URL, '30D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('period=30D')
    )
  })

  it('calls /api/breakdowns/pages endpoint', async () => {
    mockFetchOk(mockTopPages)
    await fetchTopPages(BASE_URL, '7D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/breakdowns/pages')
    )
  })
})

describe('fetchTrafficSources', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns Ok with traffic sources on success', async () => {
    mockFetchOk(mockTrafficSources)
    const result = await fetchTrafficSources(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.sources).toHaveLength(2)
      expect(result.value.sources[0].category).toBe('Search')
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchTrafficSources(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('calls /api/breakdowns/sources endpoint', async () => {
    mockFetchOk(mockTrafficSources)
    await fetchTrafficSources(BASE_URL, '7D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/breakdowns/sources')
    )
  })
})

describe('fetchLeadActions', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns Ok with lead actions on success', async () => {
    mockFetchOk(mockLeadActions)
    const result = await fetchLeadActions(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.actions).toHaveLength(2)
      expect(result.value.actions[0].action).toBe('LEAD_PHONE')
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchLeadActions(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('calls /api/breakdowns/actions endpoint', async () => {
    mockFetchOk(mockLeadActions)
    await fetchLeadActions(BASE_URL, '7D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/breakdowns/actions')
    )
  })
})
