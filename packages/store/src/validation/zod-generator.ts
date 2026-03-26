import { z } from 'zod'
import type { ZodTypeAny } from 'zod'
import type { StoreFieldConfig } from '../fields/store-field-types.js'

type SchemaBuilder = (field: StoreFieldConfig) => ZodTypeAny

function buildTextSchema (field: StoreFieldConfig): ZodTypeAny {
  let schema = z.string()
  if ('minLength' in field && field.minLength !== undefined) {
    schema = schema.min(field.minLength)
  }
  if ('maxLength' in field && field.maxLength !== undefined) {
    schema = schema.max(field.maxLength)
  }
  return schema
}

function buildNumberSchema (field: StoreFieldConfig): ZodTypeAny {
  let schema = z.coerce.number()
  if ('min' in field && field.min !== undefined) {
    schema = schema.min(field.min)
  }
  if ('max' in field && field.max !== undefined) {
    schema = schema.max(field.max)
  }
  return schema
}

function buildBooleanSchema (): ZodTypeAny {
  return z.boolean()
}

function buildSelectSchema (field: StoreFieldConfig): ZodTypeAny {
  if ('options' in field && Array.isArray(field.options) && field.options.length > 0) {
    const [first, ...rest] = field.options as [string, ...string[]]
    return z.enum([first, ...rest])
  }
  return z.string()
}

function buildMultiselectSchema (field: StoreFieldConfig): ZodTypeAny {
  if ('options' in field && Array.isArray(field.options) && field.options.length > 0) {
    const [first, ...rest] = field.options as [string, ...string[]]
    return z.array(z.enum([first, ...rest]))
  }
  return z.array(z.string())
}

function buildDateSchema (): ZodTypeAny {
  return z.string()
}

function buildEmailSchema (): ZodTypeAny {
  return z.string().email()
}

function buildUrlSchema (): ZodTypeAny {
  return z.string().url()
}

function buildColorSchema (): ZodTypeAny {
  return z.string()
}

function buildSlugSchema (): ZodTypeAny {
  return z.string()
}

function buildJsonSchema (): ZodTypeAny {
  return z.unknown()
}

function buildCustomSchema (field: StoreFieldConfig): ZodTypeAny {
  if ('validator' in field) {
    return field.validator
  }
  return z.unknown()
}

function buildArraySchema (field: StoreFieldConfig): ZodTypeAny {
  if ('fields' in field && Array.isArray(field.fields)) {
    return z.array(buildObjectSchema(field.fields))
  }
  return z.array(z.object({}))
}

function buildGroupSchema (field: StoreFieldConfig): ZodTypeAny {
  if ('fields' in field && Array.isArray(field.fields)) {
    return buildObjectSchema(field.fields)
  }
  return z.object({})
}

const STORE_FIELD_SCHEMA_MAP: Readonly<Record<string, SchemaBuilder | undefined>> = Object.freeze({
  text: buildTextSchema,
  textarea: buildTextSchema,
  number: buildNumberSchema,
  boolean: buildBooleanSchema,
  select: buildSelectSchema,
  multiselect: buildMultiselectSchema,
  date: buildDateSchema,
  email: buildEmailSchema,
  url: buildUrlSchema,
  color: buildColorSchema,
  slug: buildSlugSchema,
  json: buildJsonSchema,
  custom: buildCustomSchema,
  array: buildArraySchema,
  group: buildGroupSchema
})

function buildObjectSchema (fields: readonly StoreFieldConfig[]): z.ZodObject<Record<string, ZodTypeAny>> {
  const shape: Record<string, ZodTypeAny> = {}

  for (const f of fields) {
    const builder = STORE_FIELD_SCHEMA_MAP[f.type]
    if (builder === undefined) continue
    shape[f.name] = builder(f).optional()
  }

  return z.object(shape)
}

export function generateStoreSchema (fields: readonly StoreFieldConfig[]): z.ZodObject<Record<string, ZodTypeAny>> {
  return buildObjectSchema(fields)
}
