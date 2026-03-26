export const StoreFieldType = Object.freeze({
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  MULTISELECT: 'multiselect',
  DATE: 'date',
  EMAIL: 'email',
  URL: 'url',
  COLOR: 'color',
  SLUG: 'slug',
  JSON: 'json',
  ARRAY: 'array',
  GROUP: 'group',
  CUSTOM: 'custom'
} as const)

export type StoreFieldType = typeof StoreFieldType[keyof typeof StoreFieldType]

interface StoreFieldBase {
  readonly name: string
  readonly type: StoreFieldType
}

export interface TextFieldConfig extends StoreFieldBase {
  readonly type: 'text'
  readonly default?: string
  readonly minLength?: number
  readonly maxLength?: number
}

export interface TextareaFieldConfig extends StoreFieldBase {
  readonly type: 'textarea'
  readonly default?: string
  readonly minLength?: number
  readonly maxLength?: number
}

export interface NumberFieldConfig extends StoreFieldBase {
  readonly type: 'number'
  readonly default?: number
  readonly min?: number
  readonly max?: number
}

export interface BooleanFieldConfig extends StoreFieldBase {
  readonly type: 'boolean'
  readonly default?: boolean
}

export interface SelectFieldConfig extends StoreFieldBase {
  readonly type: 'select'
  readonly options: readonly string[]
  readonly default?: string
}

export interface MultiselectFieldConfig extends StoreFieldBase {
  readonly type: 'multiselect'
  readonly options: readonly string[]
  readonly default?: readonly string[]
}

export interface DateFieldConfig extends StoreFieldBase {
  readonly type: 'date'
  readonly default?: string
}

export interface EmailFieldConfig extends StoreFieldBase {
  readonly type: 'email'
  readonly default?: string
}

export interface UrlFieldConfig extends StoreFieldBase {
  readonly type: 'url'
  readonly default?: string
}

export interface ColorFieldConfig extends StoreFieldBase {
  readonly type: 'color'
  readonly default?: string
}

export interface SlugFieldConfig extends StoreFieldBase {
  readonly type: 'slug'
  readonly slugFrom?: string
}

export interface JsonFieldConfig extends StoreFieldBase {
  readonly type: 'json'
}

export interface CustomFieldConfig extends StoreFieldBase {
  readonly type: 'custom'
  readonly validator: import('zod').ZodTypeAny
  readonly default?: unknown
}

export interface ArrayFieldConfig extends StoreFieldBase {
  readonly type: 'array'
  readonly fields: readonly StoreFieldConfig[]
}

export interface GroupFieldConfig extends StoreFieldBase {
  readonly type: 'group'
  readonly fields: readonly StoreFieldConfig[]
}

export type StoreFieldConfig =
  | TextFieldConfig
  | TextareaFieldConfig
  | NumberFieldConfig
  | BooleanFieldConfig
  | SelectFieldConfig
  | MultiselectFieldConfig
  | DateFieldConfig
  | EmailFieldConfig
  | UrlFieldConfig
  | ColorFieldConfig
  | SlugFieldConfig
  | JsonFieldConfig
  | CustomFieldConfig
  | ArrayFieldConfig
  | GroupFieldConfig
