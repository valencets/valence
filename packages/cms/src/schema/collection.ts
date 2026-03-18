import type { FieldConfig } from './field-types.js'

export interface CollectionLabels {
  readonly singular: string
  readonly plural: string
}

export interface CollectionConfig {
  readonly slug: string
  readonly labels?: CollectionLabels | undefined
  readonly fields: readonly FieldConfig[]
  readonly timestamps: boolean
  readonly auth?: boolean | undefined
  readonly upload?: boolean | undefined
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
