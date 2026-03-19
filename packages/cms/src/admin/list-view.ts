import type { CollectionConfig } from '../schema/collection.js'
import { escapeHtml } from './escape.js'

interface DocRow {
  readonly id: string
  readonly [key: string]: string | number | boolean | null
}

export function renderListView (col: CollectionConfig, docs: readonly DocRow[]): string {
  const label = escapeHtml(col.labels?.plural ?? col.slug)

  if (docs.length === 0) {
    return `<div class="empty-state"><p>No ${label} found.</p><a href="/admin/${escapeHtml(col.slug)}/new">Create one</a></div>`
  }

  const displayFields = col.fields.slice(0, 3)
  const headerCells = displayFields.map(f => `<th>${escapeHtml(f.label ?? f.name)}</th>`).join('')
  const rows = docs.map(doc => {
    const cells = displayFields.map(f => `<td>${escapeHtml(String(doc[f.name] ?? ''))}</td>`).join('')
    const safeId = escapeHtml(doc.id)
    return `<tr><td><a href="/admin/${escapeHtml(col.slug)}/${safeId}/edit">${safeId}</a></td>${cells}</tr>`
  }).join('\n')

  return `
<div class="list-header">
  <span></span>
  <a href="/admin/${escapeHtml(col.slug)}/new" class="btn btn-primary">New ${escapeHtml(col.labels?.singular ?? col.slug)}</a>
</div>
<table>
  <thead><tr><th>ID</th>${headerCells}</tr></thead>
  <tbody>${rows}</tbody>
</table>`
}
