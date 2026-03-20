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
  const label = status === 'published' ? 'Published' : 'Draft'
  return `<span class="status-badge status-${escapeHtml(status)}">${label}</span>`
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
  const slug = escapeHtml(col.slug)
  const id = escapeHtml(String(doc.id ?? ''))
  return `<form action="/admin/${slug}/${id}/unpublish" method="POST" style="display:inline;">
      ${csrfField}
      <button type="submit" class="btn btn-ghost-danger">Unpublish</button>
    </form>`
}

function renderDeleteScript (nonce: string | undefined): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : ' nonce="' + CSP_NONCE_PLACEHOLDER + '"'
  return `<script${nonceAttr}>
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
    </script>`
}

function renderDangerZone (col: CollectionConfig, doc: DocRow, csrfField: string, nonce: string | undefined, isVersioned: boolean, status: string | null): string {
  const slug = escapeHtml(col.slug)
  const id = escapeHtml(String(doc.id ?? ''))
  const label = escapeHtml(col.labels?.singular ?? col.slug)

  const unpublishHtml = isVersioned && status === 'published'
    ? renderUnpublishForm(col, doc, csrfField)
    : ''

  return `
  <div class="edit-danger-zone">
    ${unpublishHtml}
    <form id="delete-form" action="/admin/${slug}/${id}/delete" method="POST" style="display:none;">
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
    ${renderDeleteScript(nonce)}
  </div>`
}

export interface EditViewLocaleConfig {
  readonly currentLocale: string
  readonly defaultLocale: string
  readonly locales: readonly { readonly code: string; readonly label: string }[]
}

/** JSON parse boundary — see CLAUDE.md safeJsonParse exception */
function safeParseJson (str: string): Record<string, string> | null {
  try { return JSON.parse(str) } catch { return null }
}

function resolveFieldValue (raw: string | number | boolean | Date | null | undefined, localized: boolean | undefined, localeConfig: EditViewLocaleConfig | undefined): string {
  if (localized && localeConfig && raw !== null && raw !== undefined) {
    const parsed = typeof raw === 'string' ? safeParseJson(raw) : raw
    if (parsed !== null && typeof parsed === 'object' && !(parsed instanceof Date)) {
      return String((parsed as Record<string, string>)[localeConfig.currentLocale] ?? '')
    }
    return String(raw ?? '')
  }
  return raw instanceof Date
    ? raw.toISOString().slice(0, 10)
    : String(raw ?? '')
}

/** Renders the inner HTML of the form-fields container for a given set of form values.
 * Used both for initial page render and for the htmx partial re-render endpoint. */
export function renderFormFieldsFragment (col: CollectionConfig, formData: Record<string, string> | null, relationContext?: RelationContext, localeConfig?: EditViewLocaleConfig): string {
  const hasConditions = col.fields.some(f => f.condition !== undefined)
  return col.fields.filter(f =>
    formData === null || f.condition === undefined || f.condition(formData)
  ).map(f => {
    const raw = formData ? formData[f.name] : undefined
    const value = resolveFieldValue(raw, f.localized, localeConfig)
    const inputHtml = renderFieldInput(f, value, relationContext)
    return hasConditions ? `<div class="condition-trigger">${inputHtml}</div>` : inputHtml
  }).join('\n')
}

function renderLocaleTabs (col: CollectionConfig, doc: DocRow | null, localeConfig: EditViewLocaleConfig): string {
  const slug = escapeHtml(col.slug)
  return `<nav class="locale-tabs">${localeConfig.locales.map(l => {
    const active = l.code === localeConfig.currentLocale ? ' locale-tab-active' : ''
    const idSuffix = doc ? `/${escapeHtml(String(doc.id ?? ''))}/edit` : '/new'
    return `<a href="/admin/${slug}${idSuffix}?locale=${escapeHtml(l.code)}" class="locale-tab${active}">${escapeHtml(l.label)}</a>`
  }).join('')}</nav>`
}

function buildHtmxFormAttrs (hasConditionalFields: boolean, slug: string, id: string, isNew: boolean): string {
  if (!hasConditionalFields) return ''
  const partialPath = isNew ? `/admin/${slug}/new/form-fields` : `/admin/${slug}/${id}/form-fields`
  return ` hx-post="${partialPath}" hx-trigger="change from:.condition-trigger" hx-target=".form-fields" hx-swap="innerHTML" hx-include="[name]"`
}

export function renderEditView (col: CollectionConfig, doc: DocRow | null, csrfToken: string = '', relationContext?: RelationContext, nonce?: string, localeConfig?: EditViewLocaleConfig): string {
  const isNew = doc === null
  const slug = escapeHtml(col.slug)
  const id = !isNew ? escapeHtml(String(doc.id ?? '')) : ''
  const action = isNew ? `/admin/${slug}/new` : `/admin/${slug}/${id}/edit`

  const hasConditionalFields = col.fields.some(f => f.condition !== undefined)

  const hasLocalizedFields = col.fields.some(f => f.localized)
  const localeTabs = localeConfig && hasLocalizedFields
    ? renderLocaleTabs(col, doc, localeConfig)
    : ''

  const formData: Record<string, string> | null = doc
    ? Object.fromEntries(
      col.fields.map(f => [f.name, String(doc[f.name] ?? '')])
    )
    : null

  const fieldInputs = renderFormFieldsFragment(col, formData, relationContext, localeConfig)

  const csrfField = csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">` : ''

  const isVersioned = col.versions?.drafts === true
  const status = isVersioned && doc ? (doc._status as string ?? 'draft') : null

  const statusBadge = renderStatusBadge(status)
  const actionButtons = renderActionButtons(isVersioned, isNew)

  const historyLink = !isNew && doc
    ? `<a href="/admin/${slug}/${id}/history" class="action-link">View history</a>`
    : ''

  const deleteSection = !isNew && doc
    ? renderDangerZone(col, doc, csrfField, nonce, isVersioned, status)
    : ''

  const htmxAttrs = buildHtmxFormAttrs(hasConditionalFields, slug, id, isNew)
  const fieldContainer = hasConditionalFields
    ? `<div class="form-fields">\n    ${fieldInputs}\n    </div>`
    : fieldInputs

  return `
<div class="edit-container">
  ${statusBadge}
  ${localeTabs}<form action="${action}" method="POST" class="admin-form"${htmxAttrs}>
    ${csrfField}
    ${fieldContainer}
    ${actionButtons}
  </form>${historyLink ? `<div class="edit-meta">${historyLink}</div>` : ''}${deleteSection}
</div>`
}
