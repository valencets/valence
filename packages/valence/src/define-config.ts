import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'
import { z } from 'zod'
import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import type { DbPool } from '@valencets/db'
import type { CmsInstance, CollectionConfig } from '@valencets/cms'
import { validateCollections } from './validate-collections.js'

export type RouteHandler = (req: IncomingMessage, res: ServerResponse, params: Record<string, string>) => void | Promise<void>

// Passed to onServer so consumers can attach WebSocket upgrade handlers,
// register custom routes, etc., without abandoning `valence dev`.
export interface OnServerContext {
  readonly server: Server
  readonly pool: DbPool
  readonly cms: CmsInstance
  readonly registerRoute: (method: string, path: string, handler: RouteHandler) => void
}

export interface ValenceConfig {
  readonly db: {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly username: string
    readonly password: string
    readonly max?: number | undefined
    readonly idle_timeout?: number | undefined
    readonly connect_timeout?: number | undefined
    readonly query_timeout?: number | undefined
  }
  readonly server: {
    readonly port: number
    readonly host?: string | undefined
  }
  readonly collections: ReadonlyArray<CollectionConfig>
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
  // Called after CMS is built and before the HTTP server starts listening.
  // Lets consuming apps attach WebSocket upgrade handlers or custom routes.
  readonly onServer?: ((ctx: OnServerContext) => void | Promise<void>) | undefined
}

export interface ResolvedValenceConfig {
  readonly db: {
    readonly host: string
    readonly port: number
    readonly database: string
    readonly username: string
    readonly password: string
    readonly max: number
    readonly idle_timeout: number
    readonly connect_timeout: number
    readonly query_timeout?: number | undefined
  }
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

const configSchema = z.object({
  db: z.object({
    host: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    database: z.string().min(1),
    username: z.string().min(1),
    password: z.string(),
    max: z.number().int().min(1).max(100).optional(),
    idle_timeout: z.number().min(0).optional(),
    connect_timeout: z.number().min(0).optional(),
    query_timeout: z.number().min(0).optional()
  }),
  server: z.object({
    port: z.number().int().min(1).max(65535),
    host: z.string().min(1).optional()
  }),
  collections: z.array(collectionSchema),
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

export function defineConfig (config: ValenceConfig): Result<ResolvedValenceConfig, ConfigError> {
  // Strip onServer before Zod validation — Zod cannot validate function types,
  // so we preserve it separately and re-attach after resolution.
  const { onServer, ...configWithoutCallback } = config
  const parsed = configSchema.safeParse(configWithoutCallback)

  if (!parsed.success) {
    const issues = parsed.error.issues.map((issue) =>
      `${issue.path.join('.')}: ${issue.message}`
    )
    return err({
      code: 'INVALID_CONFIG',
      message: `Invalid Valence config: ${issues.join('; ')}`
    })
  }

  const collectionValidation = validateCollections(config.collections)
  if (collectionValidation.isErr()) {
    return err(collectionValidation.error)
  }

  const data = parsed.data

  const resolved: ResolvedValenceConfig = {
    db: {
      host: data.db.host,
      port: data.db.port,
      database: data.db.database,
      username: data.db.username,
      password: data.db.password,
      max: data.db.max ?? 10,
      idle_timeout: data.db.idle_timeout ?? 30,
      connect_timeout: data.db.connect_timeout ?? 10,
      query_timeout: data.db.query_timeout
    },
    server: {
      port: data.server.port,
      host: data.server.host ?? '0.0.0.0'
    },
    collections: config.collections,
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
          requireAuth: data.admin.requireAuth ?? false
        }
      : undefined,
    media: data.media
      ? {
          uploadDir: data.media.uploadDir,
          maxUploadBytes: data.media.maxUploadBytes ?? 10_000_000
        }
      : undefined,
    onServer
  }

  return ok(resolved)
}
