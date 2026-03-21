import type { FieldConfig } from './field-types.js'
import type { SearchConfig } from '../db/query-types.js'
import type { UploadConfig } from '../media/media-config.js'
import type { CollectionHooks } from '../hooks/hook-types.js'
import type { CollectionAccess } from '../access/access-types.js'

export interface CollectionLabels {
  readonly singular: string
  readonly plural: string
}

export interface VersionsConfig {
  readonly drafts: boolean
  readonly maxPerDoc?: number | undefined
}

export interface AdminConfig {
  readonly group?: string | undefined
  readonly hidden?: boolean | undefined
  readonly position?: number | undefined
  readonly displayField?: string | undefined
  readonly listFields?: readonly string[] | undefined
  readonly preview?: ((doc: Record<string, string>) => string) | string | undefined
}

export interface CollectionConfig {
  readonly slug: string
  readonly labels?: CollectionLabels | undefined
  readonly fields: readonly FieldConfig[]
  readonly timestamps: boolean
  readonly auth?: boolean | undefined
  readonly upload?: boolean | UploadConfig | undefined
  readonly search?: SearchConfig | undefined
  readonly versions?: VersionsConfig | undefined
  readonly hooks?: CollectionHooks | undefined
  readonly admin?: AdminConfig | undefined
  readonly access?: CollectionAccess | undefined
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
