import type { IncomingMessage, ServerResponse } from 'node:http'
import type { DbPool } from '@inertia/db'

export const ServerErrorCode = {
  NOT_FOUND: 'NOT_FOUND',
  METHOD_NOT_ALLOWED: 'METHOD_NOT_ALLOWED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  RATE_LIMITED: 'RATE_LIMITED'
} as const

export type ServerErrorCode = typeof ServerErrorCode[keyof typeof ServerErrorCode]

export interface ServerError {
  readonly code: ServerErrorCode
  readonly message: string
  readonly statusCode: number
}

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

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RouteContext
) => Promise<void>

export interface RouteEntry {
  readonly GET?: RouteHandler
  readonly POST?: RouteHandler
}
