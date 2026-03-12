import type { DbPool } from '@inertia/db'
import type { RouteHandler as CoreRouteHandler } from '@inertia/core/server'

export interface ServerConfig {
  readonly port: number
  readonly host: string
  readonly db: {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly username: string
    readonly password: string
    readonly max: number
    readonly idle_timeout: number
    readonly connect_timeout: number
  }
  readonly adminToken: string
  readonly contactEmail: string
  readonly siteId: string
  readonly businessType: string
  readonly siteSecret: string
  readonly studioEndpoint: string
}

export interface RouteContext {
  readonly pool: DbPool
  readonly config: ServerConfig
}

// Bound RouteHandler for Studio — all handlers import this
export type RouteHandler = CoreRouteHandler<RouteContext>

// Explicit alias for clarity in new code
export type StudioRouteHandler = RouteHandler
