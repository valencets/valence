export const FieldType = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  RICHTEXT: 'richtext',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  SELECT: 'select',
  DATE: 'date',
  SLUG: 'slug',
  MEDIA: 'media',
  RELATION: 'relation',
  GROUP: 'group',
  EMAIL: 'email',
  URL: 'url',
  PASSWORD: 'password',
  JSON: 'json',
  COLOR: 'color',
  MULTISELECT: 'multiselect',
  ARRAY: 'array',
  BLOCKS: 'blocks'
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

export interface RichtextFieldConfig extends FieldBaseConfig {
  readonly type: 'richtext'
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

export interface EmailFieldConfig extends FieldBaseConfig {
  readonly type: 'email'
}

export interface UrlFieldConfig extends FieldBaseConfig {
  readonly type: 'url'
}

export interface PasswordFieldConfig extends FieldBaseConfig {
  readonly type: 'password'
  readonly minLength?: number | undefined
  readonly maxLength?: number | undefined
}

export interface JsonFieldConfig extends FieldBaseConfig {
  readonly type: 'json'
}

export interface ColorFieldConfig extends FieldBaseConfig {
  readonly type: 'color'
}

export interface MultiselectFieldConfig extends FieldBaseConfig {
  readonly type: 'multiselect'
  readonly options: readonly SelectOption[]
}

export interface ArrayFieldConfig extends FieldBaseConfig {
  readonly type: 'array'
  readonly fields: readonly FieldConfig[]
}

export type FieldConfig =
  | TextFieldConfig
  | TextareaFieldConfig
  | RichtextFieldConfig
  | NumberFieldConfig
  | BooleanFieldConfig
  | SelectFieldConfig
  | DateFieldConfig
  | SlugFieldConfig
  | MediaFieldConfig
  | RelationFieldConfig
  | GroupFieldConfig
  | EmailFieldConfig
  | UrlFieldConfig
  | PasswordFieldConfig
  | JsonFieldConfig
  | ColorFieldConfig
  | MultiselectFieldConfig
  | ArrayFieldConfig
  | BlocksFieldConfig

export interface BlockDefinition {
  readonly slug: string
  readonly fields: readonly FieldConfig[]
  readonly labels?: { readonly singular?: string; readonly plural?: string } | undefined
}

export interface BlocksFieldConfig extends FieldBaseConfig {
  readonly type: 'blocks'
  readonly blocks: readonly BlockDefinition[]
  readonly minRows?: number | undefined
  readonly maxRows?: number | undefined
}
