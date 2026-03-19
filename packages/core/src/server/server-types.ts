import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RequestContext, Middleware, ErrorHandler } from './middleware-types.js'

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

export type RouteHandler = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext
) => Promise<void>

export interface RouteEntry {
  readonly GET?: RouteHandler
  readonly POST?: RouteHandler
  readonly PATCH?: RouteHandler
  readonly DELETE?: RouteHandler
}

export interface RouteOptions {
  readonly middleware?: readonly Middleware[]
}

export interface ServerRouter {
  readonly register: (path: string, entry: RouteEntry, options?: RouteOptions) => void
  readonly use: (middleware: Middleware) => void
  readonly onError: (handler: ErrorHandler) => void
  readonly handle: (req: IncomingMessage, res: ServerResponse) => Promise<void>
}
