import type { WhereClause } from '../db/query-types.js'

export interface AccessArgs {
  readonly req?: { readonly headers: Record<string, string> } | undefined
  readonly id?: string | undefined
  readonly data?: Record<string, string | number | boolean | null> | undefined
}

export type AccessControlFunction = (args: AccessArgs) => boolean | WhereClause

export interface CollectionAccess {
  readonly create?: AccessControlFunction | undefined
  readonly read?: AccessControlFunction | undefined
  readonly update?: AccessControlFunction | undefined
  readonly delete?: AccessControlFunction | undefined
  readonly admin?: AccessControlFunction | undefined
}

export interface FieldAccess {
  readonly create?: AccessControlFunction | undefined
  readonly read?: AccessControlFunction | undefined
  readonly update?: AccessControlFunction | undefined
}
