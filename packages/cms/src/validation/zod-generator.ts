import { z } from 'zod'
import type { ZodObject, ZodTypeAny } from 'zod'
import type { FieldConfig } from '../schema/field-types.js'

const FIELD_SCHEMA_MAP: Record<string, (field: FieldConfig) => ZodTypeAny> = {
  text: buildTextSchema,
  textarea: buildTextSchema,
  richtext: buildTextSchema,
  number: buildNumberSchema,
  boolean: buildBooleanSchema,
  select: buildSelectSchema,
  date: buildDateSchema,
  slug: buildSlugSchema,
  media: buildUuidSchema,
  relation: buildUuidSchema,
  group: buildGroupSchema,
  email: buildEmailSchema,
  url: buildUrlSchema,
  password: buildPasswordSchema,
  json: buildJsonSchema,
  color: buildColorSchema,
  multiselect: buildMultiselectSchema,
  array: buildArraySchema,
  blocks: buildBlocksSchema
}

function buildTextSchema (field: FieldConfig): ZodTypeAny {
  let schema = z.string()
  if ('minLength' in field && field.minLength !== undefined) {
    schema = schema.min(field.minLength)
  }
  if ('maxLength' in field && field.maxLength !== undefined) {
    schema = schema.max(field.maxLength)
  }
  return schema
}

function buildNumberSchema (field: FieldConfig): ZodTypeAny {
  let schema = z.coerce.number()
  if ('min' in field && field.min !== undefined) {
    schema = schema.min(field.min)
  }
  if ('max' in field && field.max !== undefined) {
    schema = schema.max(field.max)
  }
  return schema
}

function buildBooleanSchema (_field: FieldConfig): ZodTypeAny {
  return z.preprocess(
    (val) => val === 'true' ? true : val === 'false' ? false : val,
    z.boolean()
  )
}

function buildSelectSchema (field: FieldConfig): ZodTypeAny {
  if ('options' in field && field.options.length > 0) {
    const values = field.options.map(o => o.value)
    const first = values[0]
    const rest = values.slice(1)
    if (first !== undefined) {
      return z.enum([first, ...rest])
    }
  }
  return z.string()
}

function buildDateSchema (field: FieldConfig): ZodTypeAny {
  if (field.required) {
    return z.string().min(1)
  }
  return z.preprocess(
    (val) => (typeof val === 'string' && val === '') ? undefined : val,
    z.string().optional()
  )
}

function buildSlugSchema (_field: FieldConfig): ZodTypeAny {
  return z.string()
}

function buildUuidSchema (_field: FieldConfig): ZodTypeAny {
  return z.string().uuid()
}

function buildGroupSchema (field: FieldConfig): ZodTypeAny {
  if ('fields' in field) {
    return buildObjectSchema(field.fields)
  }
  return z.object({})
}

function buildEmailSchema (_field: FieldConfig): ZodTypeAny {
  return z.string().email()
}

function buildUrlSchema (_field: FieldConfig): ZodTypeAny {
  return z.string().url()
}

function buildPasswordSchema (field: FieldConfig): ZodTypeAny {
  let schema = z.string()
  if ('minLength' in field && field.minLength !== undefined) {
    schema = schema.min(field.minLength)
  }
  if ('maxLength' in field && field.maxLength !== undefined) {
    schema = schema.max(field.maxLength)
  }
  return schema
}

function buildJsonSchema (_field: FieldConfig): ZodTypeAny {
  return z.string().refine((val) => {
    try {
      JSON.parse(val)
      return true
    } catch {
      return false
    }
  }, { message: 'Invalid JSON' })
}

function buildColorSchema (_field: FieldConfig): ZodTypeAny {
  return z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Invalid hex color')
}

function buildMultiselectSchema (field: FieldConfig): ZodTypeAny {
  if ('options' in field && field.options.length > 0) {
    const values = field.options.map(o => o.value)
    const first = values[0]
    const rest = values.slice(1)
    if (first !== undefined) {
      return z.array(z.enum([first, ...rest]))
    }
  }
  return z.array(z.string())
}

function buildArraySchema (field: FieldConfig): ZodTypeAny {
  if ('fields' in field) {
    return z.array(buildObjectSchema(field.fields))
  }
  return z.array(z.object({}))
}

function buildBlocksSchema (field: FieldConfig): ZodTypeAny {
  if (!('blocks' in field)) return z.array(z.object({}))
  const blockSchemas = field.blocks.map(block => {
    const shape = buildObjectSchema(block.fields).shape
    return z.object({ blockType: z.literal(block.slug), ...shape })
  })
  let itemSchema: ZodTypeAny
  const first = blockSchemas[0]
  if (first !== undefined && blockSchemas.length >= 2) {
    const rest = blockSchemas.slice(1)
    // Zod discriminatedUnion requires [schema, ...schema[]] tuple
    itemSchema = z.discriminatedUnion('blockType', [first, ...rest] as [typeof first, ...(typeof first)[]])
  } else if (first !== undefined) {
    itemSchema = first
  } else {
    return z.array(z.object({}))
  }
  let schema = z.array(itemSchema)
  if ('minRows' in field && field.minRows !== undefined) {
    schema = schema.min(field.minRows)
  }
  if ('maxRows' in field && field.maxRows !== undefined) {
    schema = schema.max(field.maxRows)
  }
  return schema
}

function buildObjectSchema (fields: readonly FieldConfig[]): ZodObject {
  const shape: Record<string, ZodTypeAny> = {}

  for (const f of fields) {
    const builder = FIELD_SCHEMA_MAP[f.type]
    if (builder === undefined) continue
    let fieldSchema = builder(f)
    if (!f.required) {
      if (f.type === 'relation' || f.type === 'media') {
        fieldSchema = z.preprocess(
          (val) => (typeof val === 'string' && val === '') ? undefined : val,
          fieldSchema.optional()
        )
      } else {
        fieldSchema = fieldSchema.optional()
      }
    }
    shape[f.name] = fieldSchema
  }

  return z.object(shape)
}

export function generateZodSchema (fields: readonly FieldConfig[]): ZodObject {
  return buildObjectSchema(fields)
}

export function generatePartialSchema (fields: readonly FieldConfig[]): ZodObject {
  return buildObjectSchema(fields).partial()
}

export function generateDraftSchema (fields: readonly FieldConfig[]): ZodObject {
  return buildObjectSchema(fields).partial()
}
