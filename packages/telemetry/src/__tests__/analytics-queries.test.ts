import { describe, it, expect } from 'vitest'
import { makeMockPool, makeErrorPool } from '@valencets/db'
import {
  getEventCategorySummaries,
  getEventCountsByCategory,
  getPageviewsByPath,
  getDailyEventCounts
} from '../analytics-queries.js'

const start = new Date('2026-01-01')
const end = new Date('2026-01-31')

describe('getEventCategorySummaries', () => {
  it('returns category summaries from pool', async () => {
    const pool = makeMockPool([
      { event_category: 'CLICK', count: 42 },
      { event_category: 'PAGEVIEW', count: 15 }
    ])
    const result = await getEventCategorySummaries(pool, start, end)
    expect(result.isOk()).toBe(true)
    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(2)
    expect(rows[0]!.event_category).toBe('CLICK')
    expect(rows[0]!.count).toBe(42)
  })

  it('returns empty array when no data', async () => {
    const pool = makeMockPool([])
    const result = await getEventCategorySummaries(pool, start, end)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(0)
  })

  it('returns error on db failure', async () => {
    const pool = makeErrorPool({ code: 'CONNECTION_FAILED', message: 'db down' })
    const result = await getEventCategorySummaries(pool, start, end)
    expect(result.isErr()).toBe(true)
  })
})

describe('getEventCountsByCategory', () => {
  it('returns counts for a single category', async () => {
    const pool = makeMockPool([
      { dom_target: 'button.cta', count: 10 },
      { dom_target: 'a.nav', count: 5 }
    ])
    const result = await getEventCountsByCategory(pool, 'CLICK', start, end)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(2)
  })

  it('accepts array of categories', async () => {
    const pool = makeMockPool([{ dom_target: 'form.lead', count: 3 }])
    const result = await getEventCountsByCategory(pool, ['LEAD_FORM', 'LEAD_EMAIL'], start, end)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(1)
  })
})

describe('getPageviewsByPath', () => {
  it('returns pageview counts grouped by path', async () => {
    const pool = makeMockPool([
      { path: '/home', views: 100 },
      { path: '/about', views: 50 }
    ])
    const result = await getPageviewsByPath(pool, start, end)
    expect(result.isOk()).toBe(true)
    const rows = result._unsafeUnwrap()
    expect(rows).toHaveLength(2)
    expect(rows[0]!.path).toBe('/home')
    expect(rows[0]!.views).toBe(100)
  })
})

describe('getDailyEventCounts', () => {
  it('returns daily counts without category filter', async () => {
    const pool = makeMockPool([
      { day: '2026-01-15', event_category: 'CLICK', dom_target: 'button', count: 8 }
    ])
    const result = await getDailyEventCounts(pool, start, end)
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(1)
  })

  it('filters by categories when provided', async () => {
    const pool = makeMockPool([
      { day: '2026-01-15', event_category: 'CLICK', dom_target: 'button', count: 8 }
    ])
    const result = await getDailyEventCounts(pool, start, end, ['CLICK'])
    expect(result.isOk()).toBe(true)
    expect(result._unsafeUnwrap()).toHaveLength(1)
  })

  it('returns empty for empty categories array', async () => {
    const pool = makeMockPool([
      { day: '2026-01-15', event_category: 'CLICK', dom_target: 'button', count: 8 }
    ])
    const result = await getDailyEventCounts(pool, start, end, [])
    expect(result.isOk()).toBe(true)
  })
})
