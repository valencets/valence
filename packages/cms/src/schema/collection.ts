import type { FieldConfig } from './field-types.js'
import type { SearchConfig } from '../db/query-types.js'

export interface CollectionLabels {
  readonly singular: string
  readonly plural: string
}

export interface VersionsConfig {
  readonly drafts: boolean
  readonly maxPerDoc?: number | undefined
}

export interface CollectionConfig {
  readonly slug: string
  readonly labels?: CollectionLabels | undefined
  readonly fields: readonly FieldConfig[]
  readonly timestamps: boolean
  readonly auth?: boolean | undefined
  readonly upload?: boolean | undefined
  readonly search?: SearchConfig | undefined
  readonly versions?: VersionsConfig | undefined
}

type CollectionInput = Omit<CollectionConfig, 'timestamps'> & {
  readonly timestamps?: boolean | undefined
}

export function collection (input: CollectionInput): CollectionConfig {
  return {
    ...input,
    timestamps: input.timestamps ?? true
  }
}
