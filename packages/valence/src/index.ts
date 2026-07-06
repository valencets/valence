export { defineConfig } from './define-config.js'
export type {
  ValenceConfig,
  ResolvedValenceConfig,
  ConfigError,
  OnServerContext,
  RouteHandler,
  RouteConfig,
  LoaderContext,
  LoaderResult,
  ActionContext,
  ActionResult,
  JsonValue,
  JsonPrimitive,
  JsonArray,
  JsonObject
} from './define-config.js'

export { generateCollectionRoutes, buildGeneratedRouteMap, buildUserRouteMap } from './route-generator.js'
export type { GeneratedRoute } from './route-generator.js'

export { executeLoader, serializeLoaderData, injectLoaderData } from './loader.js'
export type { LoaderError } from './loader.js'

export { executeAction, readRequestBody } from './action.js'
export type { ActionError } from './action.js'

export { generateRouteTypes, extractParams } from './codegen/route-type-generator.js'

// Re-export CMS schema primitives for convenience
export { collection, field, global } from '@valencets/cms'

export { setOutletHeader, isFragmentRequest } from './outlet-header.js'

export type { StoreHydrator, StoreWiringOptions } from './store-wiring.js'
