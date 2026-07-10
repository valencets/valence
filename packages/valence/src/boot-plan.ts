/**
 * The optional-everything contract: a Valence app is routes + pages by
 * default. CMS, admin panel, database, telemetry, GraphQL, and stores are
 * each opt-in, derived from the config alone. The plan names WHY a
 * database is required so boot refusals can point at the exact feature
 * instead of demanding infrastructure the app never asked for.
 */

export interface BootPlanInput {
  readonly collections: ReadonlyArray<{ readonly slug: string }>
  readonly admin?: { readonly requireAuth?: boolean | undefined } | undefined
  readonly telemetry?: { readonly enabled: boolean } | undefined
  readonly stores?: ReadonlyArray<{ readonly slug: string, readonly scope: string, readonly persist?: boolean | undefined }> | undefined
  readonly graphql?: boolean | undefined
  readonly routes?: ReadonlyArray<{ readonly path: string }> | undefined
}

export interface BootPlan {
  /** Collections exist → Local API + REST mount. */
  readonly mountCms: boolean
  /** Admin panel mounts only when the config has an admin section AND collections. */
  readonly mountAdmin: boolean
  /** GraphQL derives its schema from collections — no CMS, no endpoint. */
  readonly mountGraphql: boolean
  readonly mountTelemetry: boolean
  readonly registerStores: boolean
  /** True when any configured feature cannot run without postgres. */
  readonly needsDatabase: boolean
  /** The features that demanded the database, for accurate refusals. */
  readonly databaseReasons: readonly string[]
  /** CMS sessions and non-page store scopes sign tokens with CMS_SECRET. */
  readonly requiresSecret: boolean
}

function isPersistedStore (store: { readonly scope: string, readonly persist?: boolean | undefined }): boolean {
  return store.scope === 'user' || (store.persist === true && store.scope !== 'page')
}

export function planBoot (input: BootPlanInput): BootPlan {
  const mountCms = input.collections.length > 0
  const mountAdmin = mountCms && input.admin !== undefined
  const mountGraphql = mountCms && input.graphql === true
  const mountTelemetry = input.telemetry?.enabled === true
  const stores = input.stores ?? []
  const registerStores = stores.length > 0
  const hasServerStores = stores.some(s => s.scope !== 'page')
  const hasPersistedStores = stores.some(isPersistedStore)

  const databaseReasons: string[] = []
  if (mountCms) databaseReasons.push('collections')
  if (mountTelemetry) databaseReasons.push('telemetry')
  if (hasPersistedStores) databaseReasons.push('persisted stores')

  return {
    mountCms,
    mountAdmin,
    mountGraphql,
    mountTelemetry,
    registerStores,
    needsDatabase: databaseReasons.length > 0,
    databaseReasons,
    requiresSecret: mountCms || hasServerStores
  }
}
