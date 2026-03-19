import { z } from 'zod'
import type { ZodObject, ZodTypeAny } from 'zod'
import type { FieldConfig } from '../schema/field-types.js'

const FIELD_SCHEMA_MAP: Record<string, (field: FieldConfig) => ZodTypeAny> = {
  text: buildTextSchema,
  textarea: buildTextSchema,
  number: buildNumberSchema,
  boolean: buildBooleanSchema,
  select: buildSelectSchema,
  date: buildDateSchema,
  slug: buildSlugSchema,
  media: buildUuidSchema,
  relation: buildUuidSchema,
  group: buildGroupSchema
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

function buildObjectSchema (fields: readonly FieldConfig[]): ZodObject {
  const shape: Record<string, ZodTypeAny> = {}

  for (const f of fields) {
    const builder = FIELD_SCHEMA_MAP[f.type]
    if (builder === undefined) continue
    let fieldSchema = builder(f)
    if (!f.required) {
      fieldSchema = fieldSchema.optional()
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
