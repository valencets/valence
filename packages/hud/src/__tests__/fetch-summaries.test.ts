import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  fetchSessionSummary,
  fetchEventSummary,
  fetchConversionSummary,
  fetchIngestionHealth
} from '../data/fetch-summaries.js'
import type { SessionSummary, EventSummary, ConversionSummary, IngestionHealth } from '../types.js'

const BASE_URL = 'https://api.example.com'

const mockSession: SessionSummary = {
  period_start: '2026-03-01T00:00:00Z',
  period_end: '2026-03-07T23:59:59Z',
  total_sessions: 1247,
  unique_referrers: 12,
  device_breakdown: { mobile: 600, desktop: 500, tablet: 147 }
}

const mockEvent: EventSummary = {
  period_start: '2026-03-01T00:00:00Z',
  period_end: '2026-03-07T23:59:59Z',
  event_category: 'CONVERSION',
  total_count: 34,
  unique_sessions: 30
}

const mockConversion: ConversionSummary = {
  period_start: '2026-03-01T00:00:00Z',
  period_end: '2026-03-07T23:59:59Z',
  intent_type: 'INTENT_CALL',
  total_count: 18,
  top_sources: [{ referrer: 'google.com', count: 10 }]
}

const mockIngestion: IngestionHealth = {
  period_start: '2026-03-11T09:00:00Z',
  payloads_accepted: 12847,
  payloads_rejected: 38,
  avg_processing_ms: 2.1,
  buffer_saturation_pct: 12
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

describe('fetchSessionSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Ok with session data on success', async () => {
    mockFetchOk(mockSession)
    const result = await fetchSessionSummary(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.total_sessions).toBe(1247)
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchSessionSummary(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('passes period as query parameter', async () => {
    mockFetchOk(mockSession)
    await fetchSessionSummary(BASE_URL, '30D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('period=30D')
    )
  })
})

describe('fetchEventSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Ok with event data on success', async () => {
    mockFetchOk(mockEvent)
    const result = await fetchEventSummary(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.total_count).toBe(34)
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchEventSummary(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('passes period as query parameter', async () => {
    mockFetchOk(mockEvent)
    await fetchEventSummary(BASE_URL, 'TODAY')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('period=TODAY')
    )
  })
})

describe('fetchConversionSummary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Ok with conversion data on success', async () => {
    mockFetchOk(mockConversion)
    const result = await fetchConversionSummary(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.total_count).toBe(18)
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchConversionSummary(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('includes base URL in fetch call', async () => {
    mockFetchOk(mockConversion)
    await fetchConversionSummary(BASE_URL, '7D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(BASE_URL)
    )
  })
})

describe('fetchIngestionHealth', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns Ok with ingestion data on success', async () => {
    mockFetchOk(mockIngestion)
    const result = await fetchIngestionHealth(BASE_URL, '7D')
    expect(result.isOk()).toBe(true)
    if (result.isOk()) {
      expect(result.value.payloads_accepted).toBe(12847)
    }
  })

  it('returns Err FETCH_FAILED on network failure', async () => {
    mockFetchFail()
    const result = await fetchIngestionHealth(BASE_URL, '7D')
    expect(result.isErr()).toBe(true)
    if (result.isErr()) {
      expect(result.error.code).toBe('FETCH_FAILED')
    }
  })

  it('returns Err with message from error object', async () => {
    mockFetchFail()
    const result = await fetchIngestionHealth(BASE_URL, '7D')
    if (result.isErr()) {
      expect(result.error.message).toBe('Network error')
    }
  })

  it('accepts HudPeriod parameter', async () => {
    mockFetchOk(mockIngestion)
    await fetchIngestionHealth(BASE_URL, '90D')
    const fetchMock = vi.mocked(globalThis.fetch)
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('period=90D')
    )
  })
})
