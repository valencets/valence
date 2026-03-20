import type { IncomingMessage } from 'node:http'
import type { Middleware } from './middleware-types.js'
import { sendJson } from './http-helpers.js'

export interface AuthUser {
  readonly id: string
  readonly role: string
}

export type AuthResult =
  | { readonly authenticated: false }
  | { readonly authenticated: true; readonly user: AuthUser }

export type RoleHierarchy = Readonly<Record<string, number>>

export const DefaultRoleHierarchy: RoleHierarchy = { editor: 1, admin: 2 } as const

export function hasRole (userRole: string, requiredRole: string, hierarchy: RoleHierarchy): boolean {
  const userLevel = hierarchy[userRole] ?? 0
  const requiredLevel = hierarchy[requiredRole] ?? Infinity
  return userLevel >= requiredLevel
}

export interface AuthGuardOptions {
  readonly validate: (req: IncomingMessage) => Promise<AuthResult>
  readonly redirectTo?: string
  readonly role?: string
  readonly hierarchy?: RoleHierarchy
}

export function createAuthGuard (options: AuthGuardOptions): Middleware {
  const hierarchy = options.hierarchy ?? DefaultRoleHierarchy

  return async (req, res, ctx, next) => {
    const result = await options.validate(req)

    if (!result.authenticated) {
      sendJson(res, { error: 'Unauthorized' }, 401)
      return
    }

    if (options.role !== undefined && !hasRole(result.user.role, options.role, hierarchy)) {
      sendJson(res, { error: 'Forbidden' }, 403)
      return
    }

    const mutableCtx = ctx as typeof ctx & { user: AuthUser }
    mutableCtx.user = result.user
    await next()
  }
}
