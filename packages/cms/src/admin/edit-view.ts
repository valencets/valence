import type { CollectionConfig } from '../schema/collection.js'
import { renderFieldInput } from './field-renderers.js'
import { escapeHtml } from './escape.js'

interface DocRow {
  readonly id?: string | undefined
  readonly [key: string]: string | number | boolean | null | undefined
}

export function renderEditView (col: CollectionConfig, doc: DocRow | null, csrfToken: string = ''): string {
  const isNew = doc === null
  const action = isNew
    ? `/admin/${escapeHtml(col.slug)}/new`
    : `/admin/${escapeHtml(col.slug)}/${escapeHtml(String(doc.id ?? ''))}/edit`

  const fieldInputs = col.fields.map(f => {
    const value = doc ? String(doc[f.name] ?? '') : ''
    return renderFieldInput(f, value)
  }).join('\n')

  const csrfField = csrfToken ? `<input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">` : ''

  return `
<form action="${action}" method="POST">
  ${csrfField}
  ${fieldInputs}
  <button type="submit">${isNew ? 'Create' : 'Save'}</button>
</form>`
}
