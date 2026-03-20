import type {
  FieldConfig,
  GroupFieldConfig,
  ArrayFieldConfig,
  BlocksFieldConfig,
  BlockDefinition
} from './field-types.js'

interface FieldValueMap {
  text: string
  textarea: string
  richtext: string
  number: number
  boolean: boolean
  select: string
  date: string
  slug: string
  media: string
  relation: string
  email: string
  url: string
  password: string
  json: string
  color: string
  multiselect: string[]
}

type InferBlockType<B extends BlockDefinition> = { readonly blockType: B['slug'] } & InferFieldsType<B['fields']>

export type InferFieldType<F extends FieldConfig> =
    F extends BlocksFieldConfig
      ? Array<InferBlockType<F['blocks'][number]>>
      : F extends GroupFieldConfig
        ? InferFieldsType<F['fields']>
        : F extends ArrayFieldConfig
          ? InferFieldsType<F['fields']>[]
          : F extends { readonly type: infer T extends keyof FieldValueMap }
            ? FieldValueMap[T]
            : never

export type InferFieldsType<Fields extends readonly FieldConfig[]> = {
  [K in Fields[number] as K['name']]: InferFieldType<K>
}
