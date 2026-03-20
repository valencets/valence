import type { CollectionConfig } from '../schema/collection.js'
import { CSP_NONCE_PLACEHOLDER } from '@valencets/core/server'
import { renderFieldInput } from './field-renderers.js'
import type { RelationContext } from './field-renderers.js'
import { escapeHtml } from './escape.js'

interface DocRow {
  readonly id?: string | undefined
  readonly [key: string]: string | number | boolean | Date | null | undefined
}

function renderStatusBadge (status: string | null): string {
  if (status === null) return ''
  return `<span class="status-badge status-${escapeHtml(status)}">${status === 'published' ? 'Published' : 'Draft'}</span>`
}

function renderActionButtons (isVersioned: boolean, isNew: boolean): string {
  if (isVersioned) {
    return `<div class="form-actions">
      <button type="submit" name="_action" value="draft" class="btn">Save Draft</button>
      <button type="submit" name="_action" value="publish" class="btn btn-primary">Publish</button>
    </div>`
  }
  return `<button type="submit" class="btn btn-primary">${isNew ? 'Create' : 'Save'}</button>`
}

function renderUnpublishForm (col: CollectionConfig, doc: DocRow, csrfField: string): string {
  return `<form action="/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/unpublish" method="POST" style="display:inline;">
      ${csrfField}
      <button type="submit" class="btn btn-ghost-danger">Unpublish</button>
    </form>`
}

function renderDeleteDialog (col: CollectionConfig, doc: DocRow, csrfField: string, nonce: string | undefined): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ' nonce="' + CSP_NONCE_PLACEHOLDER + '"'
  const label = escapeHtml(col.labels?.singular ?? col.slug)
  return `
  <div class="edit-danger-zone">
    <form id="delete-form" action="/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/delete" method="POST" style="display:none;">
      ${csrfField}
    </form>
    <button type="button" class="btn btn-ghost-danger delete-trigger">Delete ${label}</button>
    <val-dialog id="delete-dialog">
      <h3 style="margin-bottom: 0.5rem;">Delete ${label}?</h3>
      <p style="color: var(--val-color-text-muted); font-size: var(--val-text-sm); margin-bottom: 1.5rem;">This action cannot be undone.</p>
      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button type="button" class="btn" id="delete-cancel" style="background: var(--val-color-bg-muted);">Cancel</button>
        <button type="button" class="btn btn-danger" id="delete-confirm">Delete</button>
      </div>
    </val-dialog>
    <script${nonceAttr}>
      (function () {
        var trigger = document.querySelector('.delete-trigger')
        var dialog = document.getElementById('delete-dialog')
        var cancel = document.getElementById('delete-cancel')
        var confirm = document.getElementById('delete-confirm')
        var form = document.getElementById('delete-form')
        if (trigger && dialog) trigger.addEventListener('click', function () { dialog.show() })
        if (cancel && dialog) cancel.addEventListener('click', function () { dialog.close() })
        if (confirm && form) confirm.addEventListener('click', function () { form.submit() })
      })()
    </script>
  </div>`
}

function renderDangerZone (col: CollectionConfig, doc: DocRow, csrfField: string, nonce: string | undefined, isVersioned: boolean, status: string | null): string {
  const unpublishSection = isVersioned && status === 'published'
    ? renderUnpublishForm(col, doc, csrfField)
    : ''

  const deleteDialog = renderDeleteDialog(col, doc, csrfField, nonce)
  const parts = deleteDialog.split('<form id="delete-form"')
  return parts[0] + unpublishSection + '\n    <form id="delete-form"' + (parts[1] ?? '')
}

export function renderEditView (col: CollectionConfig, doc: DocRow | null, csrfToken: string = '', relationContext?: RelationContext, nonce?: string): string {
  const isNew = doc === null
  const action = isNew
    ? `/admin/${escapeHtml(col.slug)}/new`
    : `/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/edit`

  const fieldInputs = col.fields.map(f => {
    const raw = doc ? doc[f.name] : null
    const value = raw instanceof Date
      ? raw.toISOString().slice(0, 10)
      : String(raw ?? '')
    return renderFieldInput(f, value, relationContext)
  }).join('\n')

  const csrfField = csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">` : ''

  const isVersioned = col.versions?.drafts === true
  const status = isVersioned && doc ? (doc._status as string ?? 'draft') : null

  const statusBadge = renderStatusBadge(status)
  const actionButtons = renderActionButtons(isVersioned, isNew)

  const historyLink = !isNew && doc
    ? `<a href="/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/history" class="action-link">View history</a>`
    : ''

  const deleteSection = !isNew && doc
    ? renderDangerZone(col, doc, csrfField, nonce, isVersioned, status)
    : ''

  return `
<div class="edit-container">
  ${statusBadge}
  <form action="${action}" method="POST" class="admin-form">
    ${csrfField}
    ${fieldInputs}
    ${actionButtons}
  </form>${historyLink ? `<div class="edit-meta">${historyLink}</div>` : ''}${deleteSection}
</div>`
}
