import { escapeHtml } from './escape.js'

interface RecentItem {
  readonly id: string
  readonly [key: string]: string | number | boolean | null
}

export interface CollectionStat {
  readonly slug: string
  readonly label: string
  readonly count: number
  readonly recent: readonly RecentItem[]
}

export interface DashboardData {
  readonly stats: readonly CollectionStat[]
}

export function renderDashboard (data: DashboardData): string {
  const cards = data.stats.map(s => {
    const label = escapeHtml(s.label)
    const slug = escapeHtml(s.slug)
    return `<div class="card"><a href="/admin/${slug}"><h3>${label}</h3><p class="stat-count">${s.count}</p></a></div>`
  }).join('\n')

  const allRecent: Array<{ collection: string; slug: string; label: string; created: string }> = []
  for (const s of data.stats) {
    for (const item of s.recent) {
      const keys = Object.keys(item).filter(k => k !== 'id' && k !== 'created_at' && k !== 'updated_at' && k !== 'deleted_at')
      const label = keys.length > 0 ? String(item[keys[0]!] ?? '') : String(item.id)
      const created = item.created_at != null ? String(item.created_at) : ''
      allRecent.push({ collection: s.label, slug: s.slug, label, created })
    }
  }

  const recentSection = allRecent.length > 0
    ? `<h2 style="margin-top: 2rem; margin-bottom: 0.5rem; font-size: var(--val-text-xl); font-weight: var(--val-weight-semibold);">Recent Activity</h2>
<table>
  <thead><tr><th>Collection</th><th>Item</th><th>Created</th></tr></thead>
  <tbody>
${allRecent.map(r => `    <tr><td>${escapeHtml(r.collection)}</td><td>${escapeHtml(r.label)}</td><td>${escapeHtml(r.created)}</td></tr>`).join('\n')}
  </tbody>
</table>`
    : ''

  return `<div class="dashboard">${cards}</div>\n${recentSection}`
}
