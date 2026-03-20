import { escapeHtml } from './escape.js'

interface TopPageEntry {
  readonly path: string
  readonly count: number
}

interface TopReferrerEntry {
  readonly referrer: string
  readonly count: number
}

interface EventCategoryEntry {
  readonly event_category: string
  readonly count: number
}

interface PageviewEntry {
  readonly path: string
  readonly views: number
}

interface DailyEventEntry {
  readonly day: string
  readonly event_category: string
  readonly dom_target: string | null
  readonly count: number
}

interface AnalyticsData {
  readonly sessionCount: number
  readonly pageviewCount: number
  readonly conversionCount: number
  readonly topPages: ReadonlyArray<TopPageEntry>
  readonly topReferrers: ReadonlyArray<TopReferrerEntry>
  readonly eventCategories?: ReadonlyArray<EventCategoryEntry>
  readonly pageviewsByPath?: ReadonlyArray<PageviewEntry>
  readonly dailyEvents?: ReadonlyArray<DailyEventEntry>
}

export function renderAnalyticsView (data: AnalyticsData | null): string {
  if (!data) {
    return `<div class="empty-state">
  <p>Analytics is not configured. Add a <code>telemetryPool</code> to your CMS config to enable analytics.</p>
</div>`
  }

  const statCards = `<div class="dashboard" style="margin-bottom: 2rem;">
  <div class="card">
    <h3>${data.sessionCount.toLocaleString()}</h3>
    <p style="color: var(--val-color-text-muted); font-size: var(--val-text-sm); margin-top: 0.25rem;">Sessions</p>
  </div>
  <div class="card">
    <h3>${data.pageviewCount.toLocaleString()}</h3>
    <p style="color: var(--val-color-text-muted); font-size: var(--val-text-sm); margin-top: 0.25rem;">Pageviews</p>
  </div>
  <div class="card">
    <h3>${data.conversionCount.toLocaleString()}</h3>
    <p style="color: var(--val-color-text-muted); font-size: var(--val-text-sm); margin-top: 0.25rem;">Conversions</p>
  </div>
</div>`

  const pagesTable = data.topPages.length > 0
    ? `<h2 style="font-size: var(--val-text-lg); font-weight: var(--val-weight-semibold); margin-bottom: 0.5rem;">Top Pages</h2>
<table>
  <thead><tr><th>Path</th><th style="text-align: right;">Views</th></tr></thead>
  <tbody>
${data.topPages.map(p => `    <tr><td>${escapeHtml(p.path)}</td><td style="text-align: right;">${p.count.toLocaleString()}</td></tr>`).join('\n')}
  </tbody>
</table>`
    : ''

  const referrersTable = data.topReferrers.length > 0
    ? `<h2 style="font-size: var(--val-text-lg); font-weight: var(--val-weight-semibold); margin: 1.5rem 0 0.5rem;">Top Referrers</h2>
<table>
  <thead><tr><th>Referrer</th><th style="text-align: right;">Sessions</th></tr></thead>
  <tbody>
${data.topReferrers.map(r => `    <tr><td>${escapeHtml(r.referrer)}</td><td style="text-align: right;">${r.count.toLocaleString()}</td></tr>`).join('\n')}
  </tbody>
</table>`
    : ''

  const eventCategoriesSection = data.eventCategories && data.eventCategories.length > 0
    ? `<div class="analytics-section">
  <h3>Event Categories</h3>
  <table class="val-table">
    <thead><tr><th>Category</th><th>Count</th></tr></thead>
    <tbody>
${data.eventCategories.map(e => `      <tr><td>${escapeHtml(e.event_category)}</td><td>${e.count.toLocaleString()}</td></tr>`).join('\n')}
    </tbody>
  </table>
</div>`
    : ''

  const pageviewsByPathSection = data.pageviewsByPath && data.pageviewsByPath.length > 0
    ? `<div class="analytics-section">
  <h3>Top Pages (Detailed)</h3>
  <div style="overflow-x: auto">
    <table class="val-table">
      <thead><tr><th>Path</th><th>Views</th></tr></thead>
      <tbody>
${data.pageviewsByPath.map(p => `        <tr><td>${escapeHtml(p.path)}</td><td>${p.views.toLocaleString()}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
</div>`
    : ''

  const dailyEventsSection = data.dailyEvents && data.dailyEvents.length > 0
    ? `<div class="analytics-section">
  <h3>Daily Activity</h3>
  <div style="overflow-x: auto">
    <table class="val-table">
      <thead><tr><th>Day</th><th>Category</th><th>Target</th><th>Count</th></tr></thead>
      <tbody>
${data.dailyEvents.map(e => `        <tr><td>${escapeHtml(e.day)}</td><td>${escapeHtml(e.event_category)}</td><td>${escapeHtml(e.dom_target ?? '')}</td><td>${e.count.toLocaleString()}</td></tr>`).join('\n')}
      </tbody>
    </table>
  </div>
</div>`
    : ''

  const noData = data.topPages.length === 0 && data.topReferrers.length === 0 && data.sessionCount === 0
    ? '<p class="empty-state">No analytics data yet. Data will appear here once visitors start arriving.</p>'
    : ''

  return `${statCards}
${pagesTable}
${referrersTable}
${eventCategoriesSection}
${pageviewsByPathSection}
${dailyEventsSection}
${noData}`
}
