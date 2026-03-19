import { escapeHtml } from './escape.js'

interface RevisionSummary {
  readonly id: string
  readonly revision_number: number
  readonly created_at: string
}

type DiffData = Record<string, string | number | boolean | null>

export function renderRevisionList (collectionSlug: string, documentId: string, revisions: readonly RevisionSummary[]): string {
  const safeSlug = escapeHtml(collectionSlug)
  const safeId = escapeHtml(documentId)
  const backLink = `<a href="/admin/${safeSlug}/${safeId}/edit" class="action-link">&larr; Back to edit</a>`

  if (revisions.length === 0) {
    return `${backLink}<p class="empty-state">No revisions yet.</p>`
  }

  const rows = revisions.map(r => {
    const date = new Date(r.created_at).toLocaleString()
    return `<tr><td><a href="/admin/${safeSlug}/${safeId}/history/${r.revision_number}">Revision ${r.revision_number}</a></td><td>${escapeHtml(date)}</td></tr>`
  }).join('\n')

  return `${backLink}
<table>
  <thead><tr><th>Revision</th><th>Date</th></tr></thead>
  <tbody>${rows}</tbody>
</table>`
}

export function renderRevisionDiff (
  collectionSlug: string,
  documentId: string,
  revisionNumber: number,
  oldData: DiffData,
  newData: DiffData
): string {
  const safeSlug = escapeHtml(collectionSlug)
  const safeId = escapeHtml(documentId)
  const backLink = `<a href="/admin/${safeSlug}/${safeId}/history" class="action-link">&larr; Back to history</a>`

  const allKeys = [...new Set([...Object.keys(oldData), ...Object.keys(newData)])]
  const diffRows = allKeys.map(key => {
    const oldVal = String(oldData[key] ?? '')
    const newVal = String(newData[key] ?? '')
    const changed = oldVal !== newVal
    const rowClass = changed ? ' class="diff-changed"' : ''
    return `<tr${rowClass}><td>${escapeHtml(key)}</td><td>${escapeHtml(oldVal)}</td><td>${escapeHtml(newVal)}</td></tr>`
  }).join('\n')

  return `${backLink}
<h3>Revision ${revisionNumber}</h3>
<table class="diff-table">
  <thead><tr><th>Field</th><th>Before</th><th>After</th></tr></thead>
  <tbody>${diffRows}</tbody>
</table>`
}
