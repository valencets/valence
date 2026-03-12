// Site registry types — one row per registered client site

export const Vertical = [
  'barbershop', 'restaurant', 'legal', 'dental',
  'fitness', 'auto', 'studio', 'other'
] as const

export type Vertical = typeof Vertical[number]

export const Tier = [
  'build_only', 'managed', 'enterprise'
] as const

export type Tier = typeof Tier[number]

export interface SiteRow {
  readonly id: string
  readonly name: string
  readonly slug: string
  readonly vertical: string
  readonly sub_vertical: string | null
  readonly location: string | null
  readonly tier: string
  readonly registered_at: Date
  readonly appliance_hardware: string | null
  readonly lead_action_schema: unknown | null
}

export interface InsertableSite {
  readonly name: string
  readonly slug: string
  readonly vertical: string
  readonly sub_vertical: string | null
  readonly location: string | null
  readonly tier: string
  readonly appliance_hardware: string | null
  readonly lead_action_schema: unknown | null
}
