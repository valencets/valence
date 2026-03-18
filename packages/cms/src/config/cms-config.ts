import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import type { DbPool } from '@valencets/db'
import type { CollectionConfig } from '../schema/collection.js'
import type { GlobalConfig } from '../schema/global.js'
import type { CollectionRegistry, GlobalRegistry } from '../schema/registry.js'
import type { LocalApi } from '../api/local-api.js'
import type { Plugin } from './plugin.js'
import type { CmsError } from '../schema/types.js'
import type { RestRouteEntry } from '../api/rest-api.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { createLocalApi } from '../api/local-api.js'
import { createRestRoutes } from '../api/rest-api.js'
import { createAdminRoutes } from '../admin/admin-routes.js'

export interface CmsConfig {
  readonly db: DbPool
  readonly secret: string
  readonly collections: readonly CollectionConfig[]
  readonly globals?: readonly GlobalConfig[] | undefined
  readonly plugins?: readonly Plugin[] | undefined
}

export interface CmsInstance {
  readonly api: LocalApi
  readonly collections: CollectionRegistry
  readonly globals: GlobalRegistry
  readonly restRoutes: Map<string, RestRouteEntry>
  readonly adminRoutes: Map<string, RestRouteEntry>
}

export function buildCms (inputConfig: CmsConfig): Result<CmsInstance, CmsError> {
  const config = inputConfig.plugins
    ? inputConfig.plugins.reduce<CmsConfig>((cfg, plugin) => plugin(cfg), inputConfig)
    : inputConfig

  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()

  for (const col of config.collections) {
    const result = collections.register(col)
    if (result.isErr()) return err(result.error)
  }

  if (config.globals) {
    for (const g of config.globals) {
      const result = globals.register(g)
      if (result.isErr()) return err(result.error)
    }
  }

  const api = createLocalApi(config.db, collections, globals)
  const restRoutes = createRestRoutes(config.db, collections, globals)
  const adminRoutes = createAdminRoutes(config.db, collections)

  return ok({
    api,
    collections,
    globals,
    restRoutes,
    adminRoutes
  })
}
