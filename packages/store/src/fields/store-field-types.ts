export const StoreFieldType = Object.freeze({
  TEXT: 'text',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  DATE: 'date',
  JSON: 'json',
  ARRAY: 'array',
  GROUP: 'group'
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

export interface DateFieldConfig extends StoreFieldBase {
  readonly type: 'date'
  readonly default?: string
}

export interface JsonFieldConfig extends StoreFieldBase {
  readonly type: 'json'
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
  | NumberFieldConfig
  | BooleanFieldConfig
  | SelectFieldConfig
  | DateFieldConfig
  | JsonFieldConfig
  | ArrayFieldConfig
  | GroupFieldConfig
