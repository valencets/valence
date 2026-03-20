import type { CollectionConfig, FieldConfig } from '@valencets/cms'
import { pascalCase, singularize } from './naming.js'

const FIELD_TS_TYPE_MAP: Record<string, (field: FieldConfig) => string> = {
  text: () => 'string',
  textarea: () => 'string',
  richtext: () => 'string',
  number: () => 'number',
  boolean: () => 'boolean',
  select: fieldToSelectType,
  multiselect: fieldToMultiselectType,
  date: () => 'string',
  slug: () => 'string',
  media: () => 'string',
  relation: fieldToRelationType,
  group: fieldToGroupType,
  email: () => 'string',
  url: () => 'string',
  password: () => 'string',
  json: () => 'string',
  color: () => 'string',
  array: fieldToArrayType,
  blocks: fieldToBlocksType
}

function fieldToSelectType (field: FieldConfig): string {
  if ('options' in field && field.options.length > 0) {
    return field.options.map(o => `'${o.value}'`).join(' | ')
  }
  return 'string'
}

function fieldToMultiselectType (field: FieldConfig): string {
  if ('options' in field && field.options.length > 0) {
    const union = field.options.map(o => `'${o.value}'`).join(' | ')
    return `Array<${union}>`
  }
  return 'string[]'
}

function fieldToRelationType (field: FieldConfig): string {
  if ('hasMany' in field && field.hasMany) return 'string[]'
  return 'string'
}

function fieldToGroupType (field: FieldConfig): string {
  if ('fields' in field) {
    const props = (field.fields as readonly FieldConfig[]).map(f => fieldToProperty(f, '    ')).join('\n')
    return `{\n${props}\n  }`
  }
  return '{}'
}

function fieldToArrayType (field: FieldConfig): string {
  if ('fields' in field) {
    const props = (field.fields as readonly FieldConfig[]).map(f => fieldToProperty(f, '    ')).join('\n')
    return `Array<{\n${props}\n  }>`
  }
  return 'Array<{}>'
}

function fieldToBlocksType (field: FieldConfig): string {
  if ('blocks' in field) {
    const blockTypes = (field.blocks as readonly { readonly slug: string; readonly fields: readonly FieldConfig[] }[]).map(block => {
      const props = block.fields.map(f => fieldToProperty(f, '      ')).join('\n')
      return "  | { readonly blockType: '" + block.slug + "' } & {\n" + props + '\n    }'
    }).join('\n')
    return 'Array<\n' + blockTypes + '\n  >'
  }
  return 'Array<{}>'
}

function fieldToProperty (field: FieldConfig, indent: string = '  '): string {
  const mapper = FIELD_TS_TYPE_MAP[field.type]
  const tsType = mapper !== undefined ? mapper(field) : 'string'
  const optional = field.required ? '' : '?'
  return `${indent}readonly ${field.name}${optional}: ${tsType}`
}

export function generateEntityInterface (collection: CollectionConfig): string {
  const name = pascalCase(singularize(collection.slug))
  const fields = collection.fields.map(f => fieldToProperty(f)).join('\n')
  const timestamps = collection.timestamps
    ? '\n  readonly createdAt: string\n  readonly updatedAt: string'
    : ''

  return `// @generated — regenerated from valence.config.ts. DO NOT EDIT.

export interface ${name} {
  readonly id: string
${fields}${timestamps}
}
`
}
