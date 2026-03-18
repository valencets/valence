export const FieldType = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  DATE: 'date',
  SLUG: 'slug',
  MEDIA: 'media',
  RELATION: 'relation',
  GROUP: 'group'
} as const

export type FieldType = typeof FieldType[keyof typeof FieldType]

// --- Shared base options ---

export interface FieldBaseConfig {
  readonly name: string
  readonly required?: boolean | undefined
  readonly unique?: boolean | undefined
  readonly index?: boolean | undefined
  readonly defaultValue?: string | number | boolean | null | undefined
  readonly hidden?: boolean | undefined
  readonly localized?: boolean | undefined
  readonly label?: string | undefined
}

// --- Per-type configs ---

export interface TextFieldConfig extends FieldBaseConfig {
  readonly type: 'text'
  readonly minLength?: number | undefined
  readonly maxLength?: number | undefined
}

export interface TextareaFieldConfig extends FieldBaseConfig {
  readonly type: 'textarea'
  readonly minLength?: number | undefined
  readonly maxLength?: number | undefined
}

export interface NumberFieldConfig extends FieldBaseConfig {
  readonly type: 'number'
  readonly min?: number | undefined
  readonly max?: number | undefined
  readonly hasDecimals?: boolean | undefined
}

export interface BooleanFieldConfig extends FieldBaseConfig {
  readonly type: 'boolean'
}

export interface SelectOption {
  readonly label: string
  readonly value: string
}

export interface SelectFieldConfig extends FieldBaseConfig {
  readonly type: 'select'
  readonly options: readonly SelectOption[]
  readonly hasMany?: boolean | undefined
}

export interface DateFieldConfig extends FieldBaseConfig {
  readonly type: 'date'
}

export interface SlugFieldConfig extends FieldBaseConfig {
  readonly type: 'slug'
  readonly slugFrom?: string | undefined
}

export interface MediaFieldConfig extends FieldBaseConfig {
  readonly type: 'media'
  readonly relationTo: string
}

export interface RelationFieldConfig extends FieldBaseConfig {
  readonly type: 'relation'
  readonly relationTo: string
  readonly hasMany?: boolean | undefined
}

export interface GroupFieldConfig extends FieldBaseConfig {
  readonly type: 'group'
  readonly fields: readonly FieldConfig[]
}

export type FieldConfig =
  | TextFieldConfig
  | TextareaFieldConfig
  | NumberFieldConfig
  | BooleanFieldConfig
  | SelectFieldConfig
  | DateFieldConfig
  | SlugFieldConfig
  | MediaFieldConfig
  | RelationFieldConfig
  | GroupFieldConfig
