import type { CollectionConfig } from '../schema/collection.js'
import { renderFieldInput } from './field-renderers.js'

interface DocRow {
  readonly id?: string | undefined
  readonly [key: string]: string | number | boolean | null | undefined
}

export function renderEditView (col: CollectionConfig, doc: DocRow | null): string {
  const isNew = doc === null
  const action = isNew
    ? `/api/${col.slug}`
    : `/api/${col.slug}/${doc.id}`
  const method = isNew ? 'POST' : 'PATCH'

  const fieldInputs = col.fields.map(f => {
    const value = doc ? String(doc[f.name] ?? '') : ''
    return renderFieldInput(f, value)
  }).join('\n')

  return `
<form action="${action}" method="POST" data-method="${method}">
  ${fieldInputs}
  <button type="submit">${isNew ? 'Create' : 'Save'}</button>
</form>`
}
