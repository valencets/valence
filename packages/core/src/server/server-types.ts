import type { IncomingMessage, ServerResponse } from 'node:http'

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

export type RouteHandler<TCtx = unknown> = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: TCtx
) => Promise<void>

export interface RouteEntry<TCtx = unknown> {
  readonly GET?: RouteHandler<TCtx>
  readonly POST?: RouteHandler<TCtx>
}

export interface ServerRouter<TCtx = unknown> {
  readonly register: (path: string, entry: RouteEntry<TCtx>) => void
  readonly handle: (req: IncomingMessage, res: ServerResponse, ctx: TCtx) => Promise<void>
}
