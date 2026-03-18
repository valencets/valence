import type { FieldConfig } from './field-types.js'

export interface GlobalConfig {
  readonly slug: string
  readonly label?: string | undefined
  readonly fields: readonly FieldConfig[]
}

export function global (input: GlobalConfig): GlobalConfig {
  return { ...input }
}
