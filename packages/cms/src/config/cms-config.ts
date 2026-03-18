import type { DbPool } from '@valencets/db'
import type { CollectionConfig } from '../schema/collection.js'
import type { GlobalConfig } from '../schema/global.js'
import type { CollectionRegistry, GlobalRegistry } from '../schema/registry.js'
import type { LocalApi } from '../api/local-api.js'
import type { Plugin } from './plugin.js'
import { createCollectionRegistry, createGlobalRegistry } from '../schema/registry.js'
import { createLocalApi } from '../api/local-api.js'
import { createRestRoutes } from '../api/rest-api.js'
import { createAdminRoutes } from '../admin/admin-routes.js'
import type { IncomingMessage, ServerResponse } from 'node:http'

type RouteHandler = (req: IncomingMessage, res: ServerResponse, ctx: Record<string, string>) => Promise<void>

interface RouteEntry {
  readonly GET?: RouteHandler | undefined
  readonly POST?: RouteHandler | undefined
  readonly PATCH?: RouteHandler | undefined
  readonly DELETE?: RouteHandler | undefined
}

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
  readonly restRoutes: Map<string, RouteEntry>
  readonly adminRoutes: Map<string, RouteEntry>
}

export function buildCms (inputConfig: CmsConfig): CmsInstance {
  let config = inputConfig

  if (config.plugins) {
    for (const plugin of config.plugins) {
      config = plugin(config)
    }
  }

  const collections = createCollectionRegistry()
  const globals = createGlobalRegistry()

  for (const col of config.collections) {
    collections.register(col)
  }

  if (config.globals) {
    for (const g of config.globals) {
      globals.register(g)
    }
  }

  const api = createLocalApi(config.db, collections, globals)
  const restRoutes = createRestRoutes(config.db, collections, globals)
  const adminRoutes = createAdminRoutes(config.db, collections)

  return {
    api,
    collections,
    globals,
    restRoutes,
    adminRoutes
  }
}
