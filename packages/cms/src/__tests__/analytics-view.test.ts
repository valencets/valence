import { describe, it, expect } from 'vitest'
import { renderAnalyticsView } from '../admin/analytics-view.js'

describe('renderAnalyticsView', () => {
  it('returns empty-state when data is null', () => {
    const html = renderAnalyticsView(null)
    expect(html).toContain('Analytics is not configured')
  })

  it('renders stat cards with counts', () => {
    const html = renderAnalyticsView({
      sessionCount: 100,
      pageviewCount: 250,
      conversionCount: 10,
      topPages: [],
      topReferrers: []
    })
    expect(html).toContain('100')
    expect(html).toContain('250')
    expect(html).toContain('10')
  })

  it('renders top pages table', () => {
    const html = renderAnalyticsView({
      sessionCount: 1,
      pageviewCount: 1,
      conversionCount: 0,
      topPages: [{ path: '/home', count: 50 }],
      topReferrers: []
    })
    expect(html).toContain('/home')
    expect(html).toContain('50')
  })

  it('renders event categories section', () => {
    const html = renderAnalyticsView({
      sessionCount: 1,
      pageviewCount: 1,
      conversionCount: 0,
      topPages: [],
      topReferrers: [],
      eventCategories: [
        { event_category: 'CLICK', count: 42 },
        { event_category: 'PAGEVIEW', count: 15 }
      ]
    })
    expect(html).toContain('Event Categories')
    expect(html).toContain('CLICK')
    expect(html).toContain('42')
  })

  it('renders pageviews by path section', () => {
    const html = renderAnalyticsView({
      sessionCount: 1,
      pageviewCount: 1,
      conversionCount: 0,
      topPages: [],
      topReferrers: [],
      pageviewsByPath: [{ path: '/browse', views: 200 }]
    })
    expect(html).toContain('Top Pages (Detailed)')
    expect(html).toContain('/browse')
    expect(html).toContain('200')
  })

  it('renders daily events section', () => {
    const html = renderAnalyticsView({
      sessionCount: 1,
      pageviewCount: 1,
      conversionCount: 0,
      topPages: [],
      topReferrers: [],
      dailyEvents: [{ day: '2026-01-15', event_category: 'CLICK', dom_target: 'button.cta', count: 8 }]
    })
    expect(html).toContain('Daily Activity')
    expect(html).toContain('2026-01-15')
    expect(html).toContain('button.cta')
  })

  it('omits optional sections when data is empty', () => {
    const html = renderAnalyticsView({
      sessionCount: 1,
      pageviewCount: 1,
      conversionCount: 0,
      topPages: [],
      topReferrers: [],
      eventCategories: [],
      pageviewsByPath: [],
      dailyEvents: []
    })
    expect(html).not.toContain('Event Categories')
    expect(html).not.toContain('Top Pages (Detailed)')
    expect(html).not.toContain('Daily Activity')
  })

  it('escapes HTML in event data', () => {
    const html = renderAnalyticsView({
      sessionCount: 1,
      pageviewCount: 1,
      conversionCount: 0,
      topPages: [],
      topReferrers: [],
      eventCategories: [{ event_category: '<script>alert(1)</script>', count: 1 }]
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })
})
