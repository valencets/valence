import type { CollectionConfig } from '../schema/collection.js'
import { CSP_NONCE_PLACEHOLDER } from '@valencets/core/server'
import { renderFieldInput } from './field-renderers.js'
import type { RelationContext } from './field-renderers.js'
import { escapeHtml } from './escape.js'

interface DocRow {
  readonly id?: string | undefined
  readonly [key: string]: string | number | boolean | Date | null | undefined
}

export interface EditViewLocaleConfig {
  readonly currentLocale: string
  readonly defaultLocale: string
  readonly locales: readonly { readonly code: string; readonly label: string }[]
}

/** JSON parse boundary u2014 see CLAUDE.md safeJsonParse exception */
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

export function renderEditView (col: CollectionConfig, doc: DocRow | null, csrfToken: string = '', relationContext?: RelationContext, nonce?: string, localeConfig?: EditViewLocaleConfig): string {
  const isNew = doc === null
  const action = isNew
    ? `/admin/${escapeHtml(col.slug)}/new`
    : `/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/edit`

  const hasLocalizedFields = col.fields.some(f => f.localized)
  const localeTabs = localeConfig && hasLocalizedFields
    ? `<nav class="locale-tabs">${localeConfig.locales.map(l => {
        const active = l.code === localeConfig.currentLocale ? ' locale-tab-active' : ''
        const slug = escapeHtml(col.slug)
        const id = doc ? `/${escapeHtml(String(doc.id ?? ''))}/edit` : '/new'
        return `<a href="/admin/${slug}${id}?locale=${escapeHtml(l.code)}" class="locale-tab${active}">${escapeHtml(l.label)}</a>`
      }).join('')}</nav>`
    : ''

  const fieldInputs = col.fields.map(f => {
    const raw = doc ? doc[f.name] : null
    const value = resolveFieldValue(raw, f.localized, localeConfig)
    return renderFieldInput(f, value, relationContext)
  }).join('\n')

  const csrfField = csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">` : ''

  const historyLink = !isNew && doc
    ? `<a href="/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/history" class="action-link">View history</a>`
    : ''

  const deleteSection = !isNew && doc
    ? `
  <div class="edit-danger-zone">
    <form id="delete-form" action="/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/delete" method="POST" style="display:none;">
      ${csrfField}
    </form>
    <button type="button" class="btn btn-ghost-danger delete-trigger">Delete ${escapeHtml(col.labels?.singular ?? col.slug)}</button>
    <val-dialog id="delete-dialog">
      <h3 style="margin-bottom: 0.5rem;">Delete ${escapeHtml(col.labels?.singular ?? col.slug)}?</h3>
      <p style="color: var(--val-color-text-muted); font-size: var(--val-text-sm); margin-bottom: 1.5rem;">This action cannot be undone.</p>
      <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
        <button type="button" class="btn" id="delete-cancel" style="background: var(--val-color-bg-muted);">Cancel</button>
        <button type="button" class="btn btn-danger" id="delete-confirm">Delete</button>
      </div>
    </val-dialog>
    <script${nonce ? ` nonce="${nonce}"` : ' nonce="' + CSP_NONCE_PLACEHOLDER + '"'}>
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
    : ''

  return `
<div class="edit-container">
  ${localeTabs}<form action="${action}" method="POST" class="admin-form">
    ${csrfField}
    ${fieldInputs}
    <button type="submit" class="btn btn-primary">${isNew ? 'Create' : 'Save'}</button>
  </form>${historyLink ? `<div class="edit-meta">${historyLink}</div>` : ''}${deleteSection}
</div>`
}
