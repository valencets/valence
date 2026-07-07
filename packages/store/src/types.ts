import type { StoreFieldConfig } from './fields/store-field-types.js'

export const StoreScope = Object.freeze({
  PAGE: 'page',
  SESSION: 'session',
  USER: 'user',
  GLOBAL: 'global'
} as const)

export type StoreScope = typeof StoreScope[keyof typeof StoreScope]

export const StoreErrorCode = Object.freeze({
  INVALID_SLUG: 'INVALID_SLUG',
  INVALID_FIELDS: 'INVALID_FIELDS',
  INVALID_PERSIST: 'INVALID_PERSIST',
  DUPLICATE_FIELD: 'DUPLICATE_FIELD',
  INVALID_MUTATION: 'INVALID_MUTATION',
  MUTATION_FAILED: 'MUTATION_FAILED',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  STORE_NOT_FOUND: 'STORE_NOT_FOUND',
  STATE_ERROR: 'STATE_ERROR',
  SSE_ERROR: 'SSE_ERROR',
  FLUSH_OVERFLOW: 'FLUSH_OVERFLOW'
} as const)

export type StoreErrorCode = typeof StoreErrorCode[keyof typeof StoreErrorCode]

export interface StoreError {
  readonly code: StoreErrorCode
  readonly message: string
}

/**
 * Any value that can appear in store state — recursive to support nested
 * objects/arrays. Restricted to JSON-safe values: state crosses the wire as
 * JSON and is cloned via JSON round-trips, so binary values cannot survive.
 */
export type StoreValue = import('./fields/store-field-types.js').JsonValue

/**
 * Compile-time proof that a user type is JSON-shaped. Interfaces are not
 * assignable to index-signature types even when every property fits, so
 * app data would otherwise need casts the framework itself bans.
 */
export type JsonCompatible<T> =
  T extends string | number | boolean | null | undefined ? T
    : T extends (infer U)[] ? Array<JsonCompatible<U>>
      : T extends readonly (infer U)[] ? ReadonlyArray<JsonCompatible<U>>
        : T extends object ? { [K in keyof T]: JsonCompatible<T[K]> }
          : never

/** Widen JSON-shaped app data (interfaces included) to StoreValue — an
 *  identity at runtime, a structural proof at compile time. */
export function toStoreValue<T> (value: T & JsonCompatible<T>): StoreValue {
  return value as T & JsonCompatible<T> & StoreValue
}

/** Mutable state object — shape determined by store field definitions at runtime */
export interface StoreState {
  [field: string]: StoreValue
}

/** Validated mutation input — shape determined by mutation input fields at runtime */
export interface MutationInput {
  [field: string]: StoreValue
}

export interface SessionInfo {
  readonly id: string
  readonly userId?: string
}

export interface MutationContext {
  readonly state: StoreState
  readonly input: MutationInput
}

export interface MutationServerContext extends MutationContext {
  readonly pool: { readonly query: (...args: readonly string[]) => Promise<readonly unknown[]> }
  readonly session: SessionInfo
}

export type MutationServerFn = (ctx: MutationServerContext) => Promise<void>
export type MutationClientFn = (ctx: MutationContext) => void

export interface MutationDefinition {
  readonly input: readonly StoreFieldConfig[]
  readonly server: MutationServerFn
  readonly client?: MutationClientFn
}

export type FragmentRenderFn = (state: StoreState) => string
export type DerivedFn = (state: StoreState) => StoreValue

export interface StoreDefinition {
  readonly slug: string
  readonly scope: StoreScope
  /** Durable state: back this store with postgres instead of process memory.
   *  Implied for `user` scope; opt-in for `session` and `global`. */
  readonly persist?: boolean
  readonly fields: readonly StoreFieldConfig[]
  readonly mutations: Readonly<Record<string, MutationDefinition>>
  readonly fragment?: FragmentRenderFn
  readonly derived?: Readonly<Record<string, DerivedFn>>
}

export interface StoreInput {
  readonly slug: string
  readonly scope: StoreScope
  readonly persist?: boolean
  readonly fields: readonly StoreFieldConfig[]
  readonly mutations: Record<string, {
    readonly input: readonly StoreFieldConfig[]
    readonly server: MutationServerFn
    readonly client?: MutationClientFn
  }>
  readonly fragment?: FragmentRenderFn
  readonly derived?: Record<string, DerivedFn>
}
