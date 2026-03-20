import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { CollectionConfig, FieldConfig } from '@valencets/cms'

export const CollectionValidationCode = {
  INVALID_COLLECTION_SLUG: 'INVALID_COLLECTION_SLUG',
  DUPLICATE_COLLECTION_SLUG: 'DUPLICATE_COLLECTION_SLUG',
  INVALID_SLUG_FROM: 'INVALID_SLUG_FROM'
} as const

export type CollectionValidationCode = typeof CollectionValidationCode[keyof typeof CollectionValidationCode]

export interface CollectionValidationError {
  readonly code: CollectionValidationCode
  readonly message: string
}

const SLUG_PATTERN = /^[a-z][a-z0-9-]*$/

function validateSlugFormat (slug: string): Result<void, CollectionValidationError> {
  if (!SLUG_PATTERN.test(slug)) {
    return err({
      code: CollectionValidationCode.INVALID_COLLECTION_SLUG,
      message: `Collection slug "${slug}" is invalid. Slugs must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens.`
    })
  }
  return ok(undefined)
}

function getTopLevelFieldNames (fields: readonly FieldConfig[]): ReadonlySet<string> {
  return new Set(fields.map((f) => f.name))
}

function validateSlugFromFields (
  collection: CollectionConfig
): Result<void, CollectionValidationError> {
  const fieldNames = getTopLevelFieldNames(collection.fields)
  const slugFields = collection.fields.filter((f): f is Extract<FieldConfig, { type: 'slug' }> => f.type === 'slug')

  for (const slugField of slugFields) {
    const { slugFrom } = slugField
    if (slugFrom !== undefined && !fieldNames.has(slugFrom)) {
      return err({
        code: CollectionValidationCode.INVALID_SLUG_FROM,
        message: `Collection "${collection.slug}" has a slug field "${slugField.name}" with slugFrom: "${slugFrom}", but no field named "${slugFrom}" exists in that collection.`
      })
    }
  }

  return ok(undefined)
}

export function validateCollections (
  collections: readonly CollectionConfig[]
): Result<void, CollectionValidationError> {
  for (const col of collections) {
    const formatResult = validateSlugFormat(col.slug)
    if (formatResult.isErr()) {
      return formatResult
    }
  }

  const seen = new Set<string>()
  for (const col of collections) {
    if (seen.has(col.slug)) {
      return err({
        code: CollectionValidationCode.DUPLICATE_COLLECTION_SLUG,
        message: `Duplicate collection slug "${col.slug}". Each collection must have a unique slug.`
      })
    }
    seen.add(col.slug)
  }

  for (const col of collections) {
    const slugFromResult = validateSlugFromFields(col)
    if (slugFromResult.isErr()) {
      return slugFromResult
    }
  }

  return ok(undefined)
}
