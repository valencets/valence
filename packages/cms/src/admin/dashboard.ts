import type { CollectionConfig } from '../schema/collection.js'
import { escapeHtml } from './escape.js'

export function renderDashboard (collections: readonly CollectionConfig[]): string {
  const cards = collections.map(c => {
    const label = escapeHtml(c.labels?.plural ?? c.slug)
    return `<div class="card"><a href="/admin/${escapeHtml(c.slug)}"><h3>${label}</h3></a></div>`
  }).join('\n')

  return `<div class="dashboard">${cards}</div>`
}
