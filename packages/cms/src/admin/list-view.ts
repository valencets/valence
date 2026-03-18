import type { CollectionConfig } from '../schema/collection.js'

interface DocRow {
  readonly id: string
  readonly [key: string]: string | number | boolean | null
}

export function renderListView (col: CollectionConfig, docs: readonly DocRow[]): string {
  const label = col.labels?.plural ?? col.slug

  if (docs.length === 0) {
    return `<p>No ${label} found.</p><a href="/admin/${col.slug}/new">Create one</a>`
  }

  const displayFields = col.fields.slice(0, 3)
  const headerCells = displayFields.map(f => `<th>${f.label ?? f.name}</th>`).join('')
  const rows = docs.map(doc => {
    const cells = displayFields.map(f => `<td>${String(doc[f.name] ?? '')}</td>`).join('')
    return `<tr><td><a href="/admin/${col.slug}/${doc.id}/edit">${doc.id}</a></td>${cells}</tr>`
  }).join('\n')

  return `
<a href="/admin/${col.slug}/new">New ${col.labels?.singular ?? col.slug}</a>
<table>
  <thead><tr><th>ID</th>${headerCells}</tr></thead>
  <tbody>${rows}</tbody>
</table>`
}
