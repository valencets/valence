import type {
  FieldConfig,
  GroupFieldConfig
} from './field-types.js'

interface FieldValueMap {
  text: string
  textarea: string
  number: number
  boolean: boolean
  select: string
  date: string
  slug: string
  media: string
  relation: string
}

export type InferFieldType<F extends FieldConfig> =
    F extends GroupFieldConfig
      ? InferFieldsType<F['fields']>
      : F extends { readonly type: infer T extends keyof FieldValueMap }
        ? FieldValueMap[T]
        : never

export type InferFieldsType<Fields extends readonly FieldConfig[]> = {
  [K in Fields[number] as K['name']]: InferFieldType<K>
}
