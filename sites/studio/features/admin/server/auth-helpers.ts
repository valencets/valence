import type { Result } from '@inertia/neverthrow'
import { checkAuth } from './auth-middleware.js'
import type { AuthError } from './auth-middleware.js'

export function extractTokenFromCookie (cookieHeader: string | undefined): string | undefined {
  if (!cookieHeader) return undefined
  const match = /admin_token=([^;]+)/.exec(cookieHeader)
  return match?.[1]
}

export function authenticateRequest (
  headers: { readonly authorization?: string | undefined; readonly cookie?: string | undefined },
  adminToken: string
): Result<true, AuthError> {
  const headerResult = checkAuth(headers.authorization, adminToken)
  if (headerResult.isOk()) return headerResult

  const cookieToken = extractTokenFromCookie(headers.cookie)
  if (cookieToken) {
    return checkAuth(`Bearer ${cookieToken}`, adminToken)
  }

  return headerResult
}
