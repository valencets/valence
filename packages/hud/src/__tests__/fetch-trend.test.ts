import { describe, it, expect, beforeEach, vi } from 'vitest'
import { fetchTrendData } from '../data/fetch-trend.js'
import type { TrendData } from '../types.js'

const BASE_URL = 'https://api.example.com'

const mockTrend: TrendData = {
  days: [
    { date: '2026-03-01', session_count: 20, pageview_count: 100, conversion_count: 5 },
    { date: '2026-03-02', session_count: 30, pageview_count: 150, conversion_count: 8 }
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

describe('fetchTrendData', () => {
  beforeEach(() => { vi.restoreAllMocks() })

  it('returns Ok with trend data on success', async () => {
    mockFetchOk(mockTrend)
    const result = await fetchTrendData(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.days).toHaveLength(2)
      expect(result.value.days[0].date).toBe('2026-03-01')
      expect(result.value.days[0].session_count).toBe(20)
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchTrendData(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('passes period as query parameter', async () => {
    mockFetchOk(mockTrend)
    await fetchTrendData(BASE_URL, '30D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('period=30D')
    )
  })

  it('calls /api/summaries/trend endpoint', async () => {
    mockFetchOk(mockTrend)
    await fetchTrendData(BASE_URL, '7D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/summaries/trend')
    )
  })
})
