import type { IncomingMessage, ServerResponse } from 'node:http'
import type { AuthUser } from './auth-guard.js'

export interface RequestContext {
  readonly requestId: string
  readonly startTime: readonly [number, number]
  readonly url: URL
  readonly params: Readonly<Record<string, string>>
  user?: AuthUser
}

export type Middleware = (
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext,
  next: () => Promise<void>
) => Promise<void>

export type ErrorHandler = (
  error: Error,
  req: IncomingMessage,
  res: ServerResponse,
  ctx: RequestContext
) => Promise<void>
