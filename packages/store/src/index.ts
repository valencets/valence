// Barrel export -- named exports only, no default exports
import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { StoreInput, StoreDefinition, StoreError } from './types.js'
import { StoreErrorCode } from './types.js'

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/

export function store (input: StoreInput): Result<StoreDefinition, StoreError> {
  if (!SLUG_PATTERN.test(input.slug)) {
    return err({
      code: StoreErrorCode.INVALID_SLUG,
      message: `Store slug must be lowercase, start with a letter, and contain only letters, numbers, and hyphens. Got: '${input.slug}'`
    })
  }

  if (input.fields.length === 0) {
    return err({
      code: StoreErrorCode.INVALID_SLUG,
      message: 'Store must have at least one field'
    })
  }

  const fieldNames = new Set<string>()
  for (const f of input.fields) {
    if (fieldNames.has(f.name)) {
      return err({
        code: StoreErrorCode.DUPLICATE_FIELD,
        message: `Duplicate field name: '${f.name}'`
      })
    }
    fieldNames.add(f.name)
  }

  for (const [name, mutation] of Object.entries(input.mutations)) {
    if (typeof mutation.server !== 'function') {
      return err({
        code: StoreErrorCode.INVALID_MUTATION,
        message: `Mutation '${name}' must have a server function`
      })
    }
  }

  return ok({
    slug: input.slug,
    scope: input.scope,
    fields: input.fields,
    mutations: input.mutations,
    fragment: input.fragment,
    derived: input.derived
  })
}

export { field, StoreFieldType } from './fields/index.js'
export type {
  StoreFieldConfig,
  TextFieldConfig,
  TextareaFieldConfig,
  NumberFieldConfig,
  BooleanFieldConfig,
  SelectFieldConfig,
  MultiselectFieldConfig,
  DateFieldConfig,
  EmailFieldConfig,
  UrlFieldConfig,
  ColorFieldConfig,
  SlugFieldConfig,
  JsonFieldConfig,
  CustomFieldConfig,
  ArrayFieldConfig,
  GroupFieldConfig
} from './fields/index.js'
export { StoreScope, StoreErrorCode } from './types.js'
export { generateStoreSchema } from './validation/index.js'
export type {
  StoreDefinition,
  StoreInput,
  StoreError,
  MutationDefinition,
  MutationServerFn,
  MutationClientFn,
  MutationContext,
  MutationServerContext,
  FragmentRenderFn,
  DerivedFn
} from './types.js'
export { escapeHtml } from './escape.js'
