import type { FieldConfig } from './field-types.js'

const LAYOUT_TYPES = new Set(['tabs', 'row', 'collapsible'])

export function isLayoutField (f: FieldConfig): boolean {
  return LAYOUT_TYPES.has(f.type)
}

export function flattenFields (fields: readonly FieldConfig[]): FieldConfig[] {
  const result: FieldConfig[] = []
  for (const f of fields) {
    if (f.type === 'tabs' && 'tabs' in f) {
      for (const tab of f.tabs) {
        result.push(...flattenFields(tab.fields))
      }
    } else if ((f.type === 'row' || f.type === 'collapsible') && 'fields' in f) {
      result.push(...flattenFields(f.fields))
    } else {
      result.push(f)
    }
  }
  return result
}
