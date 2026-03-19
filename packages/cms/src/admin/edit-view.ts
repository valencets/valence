import type { CollectionConfig } from '../schema/collection.js'
import { renderFieldInput } from './field-renderers.js'
import { escapeHtml } from './escape.js'

interface DocRow {
  readonly id?: string | undefined
  readonly [key: string]: string | number | boolean | Date | null | undefined
}

export function renderEditView (col: CollectionConfig, doc: DocRow | null, csrfToken: string = ''): string {
  const isNew = doc === null
  const action = isNew
    ? `/admin/${escapeHtml(col.slug)}/new`
    : `/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/edit`

  const fieldInputs = col.fields.map(f => {
    const raw = doc ? doc[f.name] : null
    const value = raw instanceof Date
      ? raw.toISOString().slice(0, 10)
      : String(raw ?? '')
    return renderFieldInput(f, value)
  }).join('\n')

  const csrfField = csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">` : ''

  return `
<form action="${action}" method="POST" class="admin-form">
  ${csrfField}
  ${fieldInputs}
  <button type="submit" class="btn btn-primary">${isNew ? 'Create' : 'Save'}</button>
</form>`
}
