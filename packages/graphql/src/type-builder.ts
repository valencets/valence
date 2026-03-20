import {
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLList,
  GraphQLObjectType
} from 'graphql'
import type { GraphQLOutputType } from 'graphql'
import type {
  FieldConfig,
  NumberFieldConfig,
  SelectFieldConfig,
  MultiselectFieldConfig,
  GroupFieldConfig,
  ArrayFieldConfig,
  BlocksFieldConfig
} from '@valencets/cms'

function buildNumberType (field: NumberFieldConfig): GraphQLOutputType {
  return field.hasDecimals === true ? GraphQLFloat : GraphQLInt
}

function buildSelectType (field: SelectFieldConfig): GraphQLOutputType {
  return new GraphQLEnumType({
    name: `${field.name}_enum`,
    values: Object.fromEntries(
      field.options.map(opt => [opt.value, { value: opt.value }])
    )
  })
}

function buildMultiselectType (field: MultiselectFieldConfig): GraphQLOutputType {
  const enumType = new GraphQLEnumType({
    name: `${field.name}_enum`,
    values: Object.fromEntries(
      field.options.map(opt => [opt.value, { value: opt.value }])
    )
  })
  return new GraphQLList(enumType)
}

function buildGroupType (field: GroupFieldConfig): GraphQLOutputType {
  return new GraphQLObjectType({
    name: `${field.name}_group`,
    fields: () => Object.fromEntries(
      field.fields.map(child => [child.name, { type: fieldToGraphQLType(child) }])
    )
  })
}

function buildArrayType (field: ArrayFieldConfig): GraphQLOutputType {
  const itemType = new GraphQLObjectType({
    name: `${field.name}_item`,
    fields: () => Object.fromEntries(
      field.fields.map(child => [child.name, { type: fieldToGraphQLType(child) }])
    )
  })
  return new GraphQLList(itemType)
}

function buildBlocksType (field: BlocksFieldConfig): GraphQLOutputType {
  const blockTypes = field.blocks.map(block =>
    new GraphQLObjectType({
      name: `${field.name}_${block.slug}_block`,
      fields: () => Object.fromEntries(
        block.fields.map(child => [child.name, { type: fieldToGraphQLType(child) }])
      )
    })
  )
  return new GraphQLList(blockTypes[0] ?? GraphQLString)
}

type FieldTypeBuilder<T extends FieldConfig> = (field: T) => GraphQLOutputType

const FIELD_GRAPHQL_TYPE_MAP = {
  text: (): GraphQLOutputType => GraphQLString,
  textarea: (): GraphQLOutputType => GraphQLString,
  richtext: (): GraphQLOutputType => GraphQLString,
  number: buildNumberType as FieldTypeBuilder<FieldConfig>,
  boolean: (): GraphQLOutputType => GraphQLBoolean,
  select: buildSelectType as FieldTypeBuilder<FieldConfig>,
  multiselect: buildMultiselectType as FieldTypeBuilder<FieldConfig>,
  date: (): GraphQLOutputType => GraphQLString,
  slug: (): GraphQLOutputType => GraphQLString,
  media: (): GraphQLOutputType => GraphQLString,
  relation: (): GraphQLOutputType => GraphQLString,
  group: buildGroupType as FieldTypeBuilder<FieldConfig>,
  email: (): GraphQLOutputType => GraphQLString,
  url: (): GraphQLOutputType => GraphQLString,
  password: (): GraphQLOutputType => GraphQLString,
  json: (): GraphQLOutputType => GraphQLString,
  color: (): GraphQLOutputType => GraphQLString,
  array: buildArrayType as FieldTypeBuilder<FieldConfig>,
  blocks: buildBlocksType as FieldTypeBuilder<FieldConfig>
} as const

export function fieldToGraphQLType (field: FieldConfig): GraphQLOutputType {
  const handler = FIELD_GRAPHQL_TYPE_MAP[field.type]
  return handler(field)
}
