import type { CollectionRegistry } from '../schema/registry.js'
import type { CollectionConfig } from '../schema/collection.js'
import type { FieldConfig } from '../schema/field-types.js'
import { flattenFields } from '../schema/field-utils.js'

interface SchemaRef {
  readonly $ref: string
}

interface JsonSchemaProperty {
  readonly type?: string
  readonly format?: string
  readonly description?: string
  readonly items?: JsonSchemaProperty | SchemaRef
  readonly properties?: Record<string, JsonSchemaProperty | SchemaRef>
  readonly enum?: readonly string[]
  readonly additionalProperties?: boolean
  readonly nullable?: boolean
}

interface OpenApiSchema {
  readonly type?: string
  readonly properties?: Record<string, JsonSchemaProperty | SchemaRef>
  readonly required?: readonly string[]
  readonly allOf?: readonly OpenApiSchema[]
  readonly items?: JsonSchemaProperty | SchemaRef
}

interface OpenApiResponse {
  readonly description: string
  readonly content?: {
    readonly 'application/json': {
      readonly schema: OpenApiSchema | { readonly $ref: string }
    }
  }
}

interface OpenApiRequestBody {
  readonly required: boolean
  readonly content: {
    readonly 'application/json': {
      readonly schema: OpenApiSchema | SchemaRef
    }
  }
}

interface OpenApiParameter {
  readonly name: string
  readonly in: string
  readonly required?: boolean
  readonly description?: string
  readonly schema: { readonly type: string; readonly format?: string; readonly default?: number; readonly minimum?: number; readonly maximum?: number }
}

interface OpenApiOperation {
  readonly summary: string
  readonly tags: readonly string[]
  readonly security: readonly Record<string, readonly string[]>[]
  readonly parameters?: readonly OpenApiParameter[]
  readonly requestBody?: OpenApiRequestBody
  readonly responses: Record<string, OpenApiResponse>
}

interface OpenApiPathItem {
  readonly get?: OpenApiOperation
  readonly post?: OpenApiOperation
  readonly patch?: OpenApiOperation
  readonly delete?: OpenApiOperation
}

interface OpenApiSpec {
  readonly openapi: string
  readonly info: {
    readonly title: string
    readonly version: string
  }
  readonly paths: Record<string, OpenApiPathItem>
  readonly components: {
    readonly securitySchemes: Record<string, {
      readonly type: string
      readonly in: string
      readonly name: string
    }>
    readonly schemas: Record<string, OpenApiSchema>
  }
}

const FIELD_TYPE_MAP: Record<string, JsonSchemaProperty> = {
  text: { type: 'string' },
  textarea: { type: 'string' },
  richtext: { type: 'string' },
  number: { type: 'number' },
  boolean: { type: 'boolean' },
  select: { type: 'string' },
  date: { type: 'string', format: 'date-time' },
  slug: { type: 'string' },
  media: { type: 'string', format: 'uuid' },
  relation: { type: 'string', format: 'uuid' },
  email: { type: 'string', format: 'email' },
  url: { type: 'string', format: 'uri' },
  password: { type: 'string' },
  json: { type: 'object', additionalProperties: true },
  color: { type: 'string' },
  multiselect: { type: 'array', items: { type: 'string' } },
  array: { type: 'array', items: { type: 'object' } },
  blocks: { type: 'array', items: { type: 'object' } },
  group: { type: 'object' }
}

function fieldToJsonSchema (f: FieldConfig): JsonSchemaProperty {
  const base = FIELD_TYPE_MAP[f.type]
  if (base !== undefined) {
    const prop = { ...base }

    if (f.type === 'select' && 'options' in f) {
      return { ...prop, enum: f.options.map(o => o.value) }
    }

    if (f.type === 'multiselect' && 'options' in f) {
      return { ...prop, items: { type: 'string', enum: f.options.map(o => o.value) } }
    }

    if (f.type === 'relation' && 'hasMany' in f && f.hasMany === true) {
      return { type: 'array', items: { type: 'string', format: 'uuid' } }
    }

    if (f.type === 'group' && 'fields' in f) {
      return buildSchemaProperties(f.fields)
    }

    if (f.type === 'array' && 'fields' in f) {
      return { type: 'array', items: buildSchemaProperties(f.fields) }
    }

    if (f.type === 'blocks' && 'blocks' in f) {
      return {
        type: 'array',
        items: {
          type: 'object',
          description: 'Block content — one of: ' + f.blocks.map(b => b.slug).join(', ')
        }
      }
    }

    if (f.type === 'number' && 'hasDecimals' in f && f.hasDecimals === true) {
      return { type: 'number', format: 'double' }
    }

    return prop
  }

  return { type: 'string' }
}

function buildSchemaProperties (fields: readonly FieldConfig[]): JsonSchemaProperty & { required?: readonly string[] } {
  const flat = flattenFields(fields)
  const properties: Record<string, JsonSchemaProperty> = {}
  const required: string[] = []

  for (const f of flat) {
    if (f.type === 'password') continue
    properties[f.name] = fieldToJsonSchema(f)
    if (f.required === true) {
      required.push(f.name)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {})
  }
}

function collectionLabel (config: CollectionConfig): string {
  return config.labels?.plural ?? config.slug
}

function buildCollectionSchema (config: CollectionConfig): OpenApiSchema {
  const flat = flattenFields(config.fields)
  const properties: Record<string, JsonSchemaProperty> = {
    id: { type: 'string', format: 'uuid' }
  }
  const required: string[] = ['id']

  for (const f of flat) {
    if (f.type === 'password') continue
    properties[f.name] = fieldToJsonSchema(f)
    if (f.required === true) {
      required.push(f.name)
    }
  }

  if (config.timestamps) {
    properties.createdAt = { type: 'string', format: 'date-time' }
    properties.updatedAt = { type: 'string', format: 'date-time' }
  }

  return { type: 'object', properties, required }
}

function buildInputSchema (config: CollectionConfig): OpenApiSchema {
  const flat = flattenFields(config.fields)
  const properties: Record<string, JsonSchemaProperty> = {}
  const required: string[] = []

  for (const f of flat) {
    properties[f.name] = fieldToJsonSchema(f)
    if (f.required === true) {
      required.push(f.name)
    }
  }

  return {
    type: 'object',
    properties,
    ...(required.length > 0 ? { required } : {})
  }
}

function schemaRef (name: string): { readonly $ref: string } {
  return { $ref: `#/components/schemas/${name}` }
}

function buildPaginatedSchema (slug: string): OpenApiSchema {
  return {
    type: 'object',
    properties: {
      docs: { type: 'array', items: schemaRef(slug) },
      totalDocs: { type: 'number' },
      page: { type: 'number' },
      totalPages: { type: 'number' },
      hasNextPage: { type: 'boolean' },
      hasPrevPage: { type: 'boolean' }
    },
    required: ['docs', 'totalDocs', 'page', 'totalPages', 'hasNextPage', 'hasPrevPage']
  }
}

function buildCollectionPaths (config: CollectionConfig): Record<string, OpenApiPathItem> {
  const label = collectionLabel(config)
  const tag = config.slug
  const security = [{ cookieAuth: [] }]

  const listPath = `/api/${config.slug}`
  const itemPath = `/api/${config.slug}/{id}`

  const listOp: OpenApiOperation = {
    summary: `List ${label}`,
    tags: [tag],
    security,
    parameters: [
      { name: 'page', in: 'query', description: 'Page number', schema: { type: 'integer', default: 1, minimum: 1 } },
      { name: 'limit', in: 'query', description: 'Items per page', schema: { type: 'integer', default: 25, minimum: 1, maximum: 100 } }
    ],
    responses: {
      200: {
        description: `Paginated list of ${label}`,
        content: { 'application/json': { schema: schemaRef(`${config.slug}Paginated`) } }
      },
      401: { description: 'Unauthorized' }
    }
  }

  const createOp: OpenApiOperation = {
    summary: `Create ${config.labels?.singular ?? config.slug}`,
    tags: [tag],
    security,
    requestBody: {
      required: true,
      content: { 'application/json': { schema: schemaRef(`${config.slug}Input`) } }
    },
    responses: {
      201: {
        description: `Created ${config.labels?.singular ?? config.slug}`,
        content: { 'application/json': { schema: schemaRef(config.slug) } }
      },
      400: { description: 'Validation error' },
      401: { description: 'Unauthorized' }
    }
  }

  const readOp: OpenApiOperation = {
    summary: `Get ${config.labels?.singular ?? config.slug} by ID`,
    tags: [tag],
    security,
    parameters: [
      { name: 'id', in: 'path', required: true, description: 'Document ID', schema: { type: 'string', format: 'uuid' } }
    ],
    responses: {
      200: {
        description: `Single ${config.labels?.singular ?? config.slug}`,
        content: { 'application/json': { schema: schemaRef(config.slug) } }
      },
      401: { description: 'Unauthorized' },
      404: { description: 'Not found' }
    }
  }

  const updateOp: OpenApiOperation = {
    summary: `Update ${config.labels?.singular ?? config.slug}`,
    tags: [tag],
    security,
    parameters: [
      { name: 'id', in: 'path', required: true, description: 'Document ID', schema: { type: 'string', format: 'uuid' } }
    ],
    requestBody: {
      required: true,
      content: { 'application/json': { schema: schemaRef(`${config.slug}Input`) } }
    },
    responses: {
      200: {
        description: `Updated ${config.labels?.singular ?? config.slug}`,
        content: { 'application/json': { schema: schemaRef(config.slug) } }
      },
      400: { description: 'Validation error' },
      401: { description: 'Unauthorized' },
      404: { description: 'Not found' }
    }
  }

  const deleteOp: OpenApiOperation = {
    summary: `Delete ${config.labels?.singular ?? config.slug}`,
    tags: [tag],
    security,
    parameters: [
      { name: 'id', in: 'path', required: true, description: 'Document ID', schema: { type: 'string', format: 'uuid' } }
    ],
    responses: {
      200: { description: 'Deleted successfully' },
      401: { description: 'Unauthorized' },
      404: { description: 'Not found' }
    }
  }

  return {
    [listPath]: { get: listOp, post: createOp },
    [itemPath]: { get: readOp, patch: updateOp, delete: deleteOp }
  }
}

export function generateOpenApiSpec (collections: CollectionRegistry): OpenApiSpec {
  const paths: Record<string, OpenApiPathItem> = {}
  const schemas: Record<string, OpenApiSchema> = {}

  for (const config of collections.getAll()) {
    const collectionPaths = buildCollectionPaths(config)
    for (const [path, item] of Object.entries(collectionPaths)) {
      paths[path] = item
    }

    schemas[config.slug] = buildCollectionSchema(config)
    schemas[`${config.slug}Input`] = buildInputSchema(config)
    schemas[`${config.slug}Paginated`] = buildPaginatedSchema(config.slug)
  }

  return {
    openapi: '3.0.3',
    info: {
      title: 'Valence CMS API',
      version: '1.0.0'
    },
    paths,
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'cms_session'
        }
      },
      schemas
    }
  }
}
