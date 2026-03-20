import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInputObjectType,
  GraphQLEnumType,
  GraphQLList,
  GraphQLString,
  GraphQLInt,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLNonNull
} from 'graphql'
import type {
  GraphQLOutputType,
  GraphQLInputType,
  GraphQLFieldConfigMap,
  GraphQLInputFieldConfigMap
} from 'graphql'
import type {
  CollectionConfig,
  FieldConfig,
  RelationFieldConfig,
  SelectFieldConfig,
  MultiselectFieldConfig,
  NumberFieldConfig,
  GroupFieldConfig,
  ArrayFieldConfig,
  BlocksFieldConfig
} from '@valencets/cms'

// --- Helpers ---

export function singularize (slug: string): string {
  if (slug.endsWith('ies')) return slug.slice(0, -3) + 'y'
  if (slug.endsWith('s')) return slug.slice(0, -1)
  return slug
}

export function capitalize (str: string): string {
  if (str.length === 0) return str
  return str[0]!.toUpperCase() + str.slice(1)
}

function getTypeName (slug: string): string {
  return capitalize(singularize(slug))
}

// --- Type registry to prevent duplicate named types ---

type NamedGraphQLType = GraphQLEnumType | GraphQLObjectType

class TypeRegistry {
  private readonly cache = new Map<string, NamedGraphQLType>()

  getOrCreate (name: string, factory: () => NamedGraphQLType): NamedGraphQLType {
    const existing = this.cache.get(name)
    if (existing !== undefined) return existing
    const created = factory()
    this.cache.set(name, created)
    return created
  }
}

// --- Field-to-type resolvers using the registry ---

function buildSelectEnumType (field: SelectFieldConfig, registry: TypeRegistry): GraphQLEnumType {
  const enumName = `${field.name}_enum`
  return registry.getOrCreate(enumName, () =>
    new GraphQLEnumType({
      name: enumName,
      values: Object.fromEntries(
        field.options.map(opt => [opt.value, { value: opt.value }])
      )
    })
  ) as GraphQLEnumType
}

function buildGroupObjectType (field: GroupFieldConfig, registry: TypeRegistry): GraphQLObjectType {
  const typeName = `${field.name}_group`
  return registry.getOrCreate(typeName, () =>
    new GraphQLObjectType({
      name: typeName,
      fields: () => Object.fromEntries(
        field.fields.map(child => [child.name, { type: resolveOutputType(child, registry) }])
      )
    })
  ) as GraphQLObjectType
}

function buildArrayItemType (field: ArrayFieldConfig, registry: TypeRegistry): GraphQLObjectType {
  const typeName = `${field.name}_item`
  return registry.getOrCreate(typeName, () =>
    new GraphQLObjectType({
      name: typeName,
      fields: () => Object.fromEntries(
        field.fields.map(child => [child.name, { type: resolveOutputType(child, registry) }])
      )
    })
  ) as GraphQLObjectType
}

type OutputTypeResolver = (field: FieldConfig, registry: TypeRegistry) => GraphQLOutputType

const OUTPUT_TYPE_MAP: { [K in FieldConfig['type']]: OutputTypeResolver } = {
  text: () => GraphQLString,
  textarea: () => GraphQLString,
  richtext: () => GraphQLString,
  number: (field) => {
    const f = field as NumberFieldConfig
    return f.hasDecimals === true ? GraphQLFloat : GraphQLInt
  },
  boolean: () => GraphQLBoolean,
  select: (field, registry) => buildSelectEnumType(field as SelectFieldConfig, registry),
  multiselect: (field, registry) => {
    const enumType = buildSelectEnumType(
      { ...field as MultiselectFieldConfig, type: 'select' },
      registry
    )
    return new GraphQLList(enumType)
  },
  date: () => GraphQLString,
  slug: () => GraphQLString,
  media: () => GraphQLString,
  relation: () => GraphQLString,
  group: (field, registry) => buildGroupObjectType(field as GroupFieldConfig, registry),
  email: () => GraphQLString,
  url: () => GraphQLString,
  password: () => GraphQLString,
  json: () => GraphQLString,
  color: () => GraphQLString,
  array: (field, registry) => {
    const itemType = buildArrayItemType(field as ArrayFieldConfig, registry)
    return new GraphQLList(itemType)
  },
  blocks: (field) => {
    const f = field as BlocksFieldConfig
    const firstBlock = f.blocks[0]
    if (firstBlock === undefined) return new GraphQLList(GraphQLString)
    // Inline block type — not cached since block types are per-field
    const blockType = new GraphQLObjectType({
      name: `${f.name}_${firstBlock.slug}_block`,
      fields: () => Object.fromEntries(
        firstBlock.fields.map(child => [child.name, { type: GraphQLString }])
      )
    })
    return new GraphQLList(blockType)
  }
}

function resolveOutputType (field: FieldConfig, registry: TypeRegistry): GraphQLOutputType {
  const resolver = OUTPUT_TYPE_MAP[field.type]
  return resolver(field, registry)
}

// --- Input type resolver ---

function resolveInputType (field: FieldConfig, registry: TypeRegistry): GraphQLInputType {
  // Complex output-only types fall back to GraphQLString for input
  const stringInputTypes = new Set<FieldConfig['type']>(['group', 'array', 'blocks'])
  if (stringInputTypes.has(field.type)) return GraphQLString

  // select/multiselect enums are valid input types — reuse via registry
  if (field.type === 'select') {
    return buildSelectEnumType(field as SelectFieldConfig, registry)
  }
  if (field.type === 'multiselect') {
    const enumType = buildSelectEnumType(
      { ...field as MultiselectFieldConfig, type: 'select' },
      registry
    )
    return new GraphQLList(enumType)
  }

  // All remaining types map to scalars
  return resolveOutputType(field, registry) as GraphQLInputType
}

function buildInputFields (
  fields: readonly FieldConfig[],
  registry: TypeRegistry
): GraphQLInputFieldConfigMap {
  const result: GraphQLInputFieldConfigMap = {}
  for (const field of fields) {
    const inputType = resolveInputType(field, registry)
    const wrapped = field.required === true
      ? new GraphQLNonNull(inputType)
      : inputType
    result[field.name] = { type: wrapped }
  }
  return result
}

// --- Build all collection types ---

interface CollectionTypes {
  readonly objectType: GraphQLObjectType
  readonly inputType: GraphQLInputObjectType
  readonly config: CollectionConfig
}

function buildObjectFields (
  config: CollectionConfig,
  typeMap: Map<string, CollectionTypes>,
  registry: TypeRegistry
): GraphQLFieldConfigMap<unknown, unknown> {
  const result: GraphQLFieldConfigMap<unknown, unknown> = {
    id: { type: GraphQLString }
  }

  for (const field of config.fields) {
    if (field.type === 'relation') {
      const relationField = field as RelationFieldConfig
      const related = typeMap.get(relationField.relationTo)
      const resolvedType: GraphQLOutputType = related !== undefined
        ? related.objectType
        : GraphQLString
      result[field.name] = { type: resolvedType }
    } else {
      result[field.name] = { type: resolveOutputType(field, registry) }
    }
  }

  if (config.timestamps) {
    result['created_at'] = { type: GraphQLString }
    result['updated_at'] = { type: GraphQLString }
  }

  return result
}

function buildCollectionTypes (
  collections: readonly CollectionConfig[]
): Map<string, CollectionTypes> {
  const typeMap = new Map<string, CollectionTypes>()
  const registry = new TypeRegistry()

  for (const config of collections) {
    const typeName = getTypeName(config.slug)

    const objectType: GraphQLObjectType = new GraphQLObjectType({
      name: typeName,
      fields: () => buildObjectFields(config, typeMap, registry)
    })

    const inputType = new GraphQLInputObjectType({
      name: `${typeName}Input`,
      fields: () => buildInputFields(config.fields, registry)
    })

    typeMap.set(config.slug, { objectType, inputType, config })
  }

  return typeMap
}

// --- Query and mutation builders ---

function buildQueryFields (
  typeMap: Map<string, CollectionTypes>
): GraphQLFieldConfigMap<unknown, unknown> {
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {}

  for (const [slug, { objectType }] of typeMap) {
    const singular = singularize(slug)

    fields[slug] = {
      type: new GraphQLList(objectType),
      args: {
        page: { type: GraphQLInt },
        limit: { type: GraphQLInt },
        sort: { type: GraphQLString },
        search: { type: GraphQLString },
        locale: { type: GraphQLString }
      }
    }

    fields[singular] = {
      type: objectType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) }
      }
    }

    fields[`${slug}Count`] = {
      type: GraphQLInt
    }
  }

  return fields
}

function buildMutationFields (
  typeMap: Map<string, CollectionTypes>
): GraphQLFieldConfigMap<unknown, unknown> {
  const fields: GraphQLFieldConfigMap<unknown, unknown> = {}

  for (const [slug, { objectType, inputType }] of typeMap) {
    const singular = singularize(slug)
    const typeName = capitalize(singular)

    fields[`create${typeName}`] = {
      type: objectType,
      args: {
        data: { type: new GraphQLNonNull(inputType) }
      }
    }

    fields[`update${typeName}`] = {
      type: objectType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) },
        data: { type: new GraphQLNonNull(inputType) }
      }
    }

    fields[`delete${typeName}`] = {
      type: objectType,
      args: {
        id: { type: new GraphQLNonNull(GraphQLString) }
      }
    }
  }

  return fields
}

// --- Main export ---

export function generateGraphQLSchema (
  collections: readonly CollectionConfig[]
): GraphQLSchema {
  const typeMap = buildCollectionTypes(collections)

  const QueryType = new GraphQLObjectType({
    name: 'Query',
    fields: () => buildQueryFields(typeMap)
  })

  const MutationType = new GraphQLObjectType({
    name: 'Mutation',
    fields: () => buildMutationFields(typeMap)
  })

  return new GraphQLSchema({
    query: QueryType,
    mutation: MutationType
  })
}
