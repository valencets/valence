import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import { z } from 'zod'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { CmsInstance, CollectionConfig } from '@valencets/cms'
import { validateCollections } from './validate-collections.js'
import type { StoreInput } from '@valencets/store'

export type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => void | Promise<void>

// Loader context passed to route loader functions on GET requests
export interface LoaderContext {
  readonly params: Record<string, string>
  readonly query: URLSearchParams
  readonly req: IncomingMessage
  readonly pool: DbPool
  readonly cms: CmsInstance
}

// Result returned by a loader function
export interface LoaderResult {
  readonly data?: Record<string, JsonValue> | undefined
  readonly status?: number | undefined
  readonly redirect?: string | undefined
  readonly headers?: Record<string, string> | undefined
}

// Action context passed to route action functions on POST/PUT/DELETE requests
export interface ActionContext {
  readonly params: Record<string, string>
  readonly body: URLSearchParams
  readonly req: IncomingMessage
  readonly pool: DbPool
  readonly cms: CmsInstance
}

// Result returned by an action function
export interface ActionResult {
  readonly data?: Record<string, JsonValue> | undefined
  readonly errors?: Record<string, string[]> | undefined
  readonly redirect?: string | undefined
  readonly status?: number | undefined
}

// JSON-serializable value types for loader/action data
export type JsonPrimitive = string | number | boolean | null
export type JsonArray = ReadonlyArray<JsonValue>
export type JsonObject = { readonly [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonArray | JsonObject

export interface RouteConfig {
  readonly path: string
  readonly method?: string | undefined
  readonly handler?: RouteHandler | undefined
  readonly collection?: string | undefined
  readonly type?: 'list' | 'detail' | undefined
  readonly outlet?: string | undefined
  readonly layout?: string | undefined
  readonly loader?: ((ctx: LoaderContext) => Promise<LoaderResult>) | undefined
  readonly action?: ((ctx: ActionContext) => Promise<ActionResult>) | undefined
}

// Passed to onServer so consumers can attach WebSocket upgrade handlers,
// register custom routes, etc., without abandoning `valence dev`.
export interface OnServerContext {
  readonly server: Server
  readonly pool: DbPool
  readonly cms: CmsInstance
  readonly registerRoute: (method: string, path: string, handler: RouteHandler) => void
}

export interface ValenceConfig {
  // Optional — only database-backed features (collections, telemetry,
  // persisted stores) need it, and it may come from .env at boot instead.
  readonly db?: {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly username: string
    readonly password: string
    readonly max?: number | undefined
    readonly idle_timeout?: number | undefined
    readonly connect_timeout?: number | undefined
    readonly query_timeout?: number | undefined
    readonly sslmode?: 'disable' | 'require' | 'verify-ca' | 'verify-full' | undefined
    readonly sslrootcert?: string | undefined
  } | undefined
  // Optional — defaults to port 3000 on 0.0.0.0.
  readonly server?: {
    readonly port?: number | undefined
    readonly host?: string | undefined
  } | undefined
  // Optional — a Valence app is routes + pages by default; collections
  // opt in to the CMS (database, REST, Local API).
  readonly collections?: ReadonlyArray<CollectionConfig> | undefined
  readonly telemetry?: {
    readonly enabled: boolean
    readonly endpoint: string
    readonly siteId: string
    readonly bufferSize?: number | undefined
    readonly flushIntervalMs?: number | undefined
  } | undefined
  readonly admin?: {
    readonly pathPrefix?: string | undefined
    readonly requireAuth?: boolean | undefined
  } | undefined
  readonly media?: {
    readonly uploadDir: string
    readonly maxUploadBytes?: number | undefined
  } | undefined
  // Schema-driven stores. Contain mutation server/client functions that
  // are not Zod-serializable — same treatment as onServer and routes.
  readonly stores?: readonly StoreInput[] | undefined
  // Called after CMS is built and before the HTTP server starts listening.
  // Lets consuming apps attach WebSocket upgrade handlers or custom routes.
  readonly onServer?: ((ctx: OnServerContext) => void | Promise<void>) | undefined
  // Schema-driven public routes. Handlers are not Zod-serializable, so
  // routes are extracted before validation and re-attached after resolution.
  readonly routes?: readonly RouteConfig[] | undefined
  // Enable the GraphQL endpoint at POST /graphql (#350). The endpoint is
  // gated behind a validated cms_session — resolvers perform no
  // per-collection access checks yet, so it inherits REST's
  // auth-by-default posture.
  readonly graphql?: boolean | undefined
}

export interface ResolvedValenceConfig {
  readonly db?: {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly username: string
    readonly password: string
    readonly max: number
    readonly idle_timeout: number
    readonly connect_timeout: number
    readonly query_timeout?: number | undefined
    readonly sslmode: 'disable' | 'require' | 'verify-ca' | 'verify-full'
    readonly sslrootcert?: string | undefined
  } | undefined
  readonly server: {
    readonly port: number
    readonly host: string
  }
  readonly collections: ReadonlyArray<CollectionConfig>
  readonly telemetry?: {
    readonly enabled: boolean
    readonly endpoint: string
    readonly siteId: string
    readonly bufferSize: number
    readonly flushIntervalMs: number
  } | undefined
  readonly admin?: {
    readonly pathPrefix: string
    readonly requireAuth: boolean
  } | undefined
  readonly media?: {
    readonly uploadDir: string
    readonly maxUploadBytes: number
  } | undefined
  // Preserved from ValenceConfig — not validated by Zod since it is a function.
  readonly onServer?: ((ctx: OnServerContext) => void | Promise<void>) | undefined
  // Preserved from ValenceConfig — handlers are functions and not Zod-serializable.
  readonly routes?: readonly RouteConfig[] | undefined
  // Preserved from ValenceConfig — mutation functions are not Zod-serializable.
  readonly stores?: readonly StoreInput[] | undefined
  // Whether GraphQL endpoint is enabled.
  readonly graphql?: boolean | undefined
}

export interface ConfigError {
  readonly code: 'INVALID_CONFIG' | 'INVALID_COLLECTION_SLUG' | 'DUPLICATE_COLLECTION_SLUG' | 'INVALID_SLUG_FROM' | 'RESERVED_FIELD_NAME' | 'DUPLICATE_FIELD_NAME' | 'INVALID_RELATION_TO'
  readonly message: string
}

const collectionSchema = z.object({
  slug: z.string(),
  fields: z.array(z.object({}).passthrough()),
  timestamps: z.boolean()
}).passthrough()

const dbSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535),
  database: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
  max: z.number().int().min(1).max(100).optional(),
  idle_timeout: z.number().min(0).optional(),
  connect_timeout: z.number().min(0).optional(),
  query_timeout: z.number().min(0).optional(),
  sslmode: z.enum(['disable', 'require', 'verify-ca', 'verify-full']).optional(),
  sslrootcert: z.string().min(1).optional()
}).superRefine((db, ctx) => {
  if ((db.sslmode === 'verify-ca' || db.sslmode === 'verify-full') && db.sslrootcert === undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sslrootcert'],
      message: `sslrootcert is required when sslmode is ${db.sslmode}`
    })
  }
})

const configSchema = z.object({
  db: dbSchema.optional(),
  server: z.object({
    port: z.number().int().min(1).max(65535).optional(),
    host: z.string().min(1).optional()
  }).optional(),
  collections: z.array(collectionSchema).optional(),
  telemetry: z.object({
    enabled: z.boolean(),
    endpoint: z.string().min(1),
    siteId: z.string().min(1),
    bufferSize: z.number().int().min(1).optional(),
    flushIntervalMs: z.number().min(1).optional()
  }).optional(),
  admin: z.object({
    pathPrefix: z.string().optional(),
    requireAuth: z.boolean().optional()
  }).optional(),
  media: z.object({
    uploadDir: z.string().min(1),
    maxUploadBytes: z.number().int().min(1).optional()
  }).optional()
})

type ParsedDbSection = NonNullable<z.infer<typeof configSchema>['db']>

function resolveDbSection (db: ParsedDbSection | undefined): ResolvedValenceConfig['db'] {
  if (!db) return undefined
  return {
    host: db.host,
    port: db.port,
    database: db.database,
    username: db.username,
    password: db.password,
    max: db.max ?? 10,
    idle_timeout: db.idle_timeout ?? 30,
    connect_timeout: db.connect_timeout ?? 10,
    query_timeout: db.query_timeout,
    sslmode: db.sslmode ?? 'disable',
    sslrootcert: db.sslrootcert
  }
}

export function defineConfig (config: ValenceConfig): Result<ResolvedValenceConfig, ConfigError> {
  // Strip onServer, routes, and stores before Zod validation — all contain function
  // values that Zod cannot validate. Preserve them and re-attach after resolution.
  const { onServer, routes, stores, graphql, ...configWithoutCallbacks } = config
  const parsed = configSchema.safeParse(configWithoutCallbacks)

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) =>
      `${issue.path.join('.')}: ${issue.message}`
    )
    return err({
      code: 'INVALID_CONFIG',
      message: `Invalid Valence config: ${issues.join('; ')}`
    })
  }

  const collectionValidation = validateCollections(config.collections ?? [])
  if (collectionValidation.isErr()) {
    const errors = collectionValidation.error
    const firstError = errors[0]
    if (firstError === undefined) {
      return err({ code: 'INVALID_CONFIG', message: 'Collection validation failed with no details.' })
    }
    return err({
      code: firstError.code,
      message: errors.length === 1
        ? firstError.message
        : errors.map((e) => e.message).join('\n')
    })
  }

  const data = parsed.data

  const resolved: ResolvedValenceConfig = {
    db: resolveDbSection(data.db),
    server: {
      port: data.server?.port ?? 3000,
      host: data.server?.host ?? '0.0.0.0'
    },
    collections: config.collections ?? [],
    telemetry: data.telemetry
      ? {
          enabled: data.telemetry.enabled,
          endpoint: data.telemetry.endpoint,
          siteId: data.telemetry.siteId,
          bufferSize: data.telemetry.bufferSize ?? 256,
          flushIntervalMs: data.telemetry.flushIntervalMs ?? 10_000
        }
      : undefined,
    admin: data.admin
      ? {
          pathPrefix: data.admin.pathPrefix ?? '/admin',
          requireAuth: data.admin.requireAuth ?? true
        }
      : undefined,
    media: data.media
      ? {
          uploadDir: data.media.uploadDir,
          maxUploadBytes: data.media.maxUploadBytes ?? 10_000_000
        }
      : undefined,
    onServer,
    routes,
    stores,
    graphql
  }

  return ok(resolved)
}
