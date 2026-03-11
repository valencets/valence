import { ok, err } from 'neverthrow'
import type { Result } from 'neverthrow'

export interface AuthError {
  readonly code: 'AUTH_FAILED'
  readonly message: string
}

export function checkAuth (
  authHeader: string | undefined,
  expectedToken: string
): Result<true, AuthError> {
  if (authHeader === undefined) {
    return err({ code: 'AUTH_FAILED', message: 'Missing Authorization header' })
  }

  const BEARER_PREFIX = 'Bearer '
  if (!authHeader.startsWith(BEARER_PREFIX)) {
    return err({ code: 'AUTH_FAILED', message: 'Invalid auth scheme' })
  }

  const token = authHeader.slice(BEARER_PREFIX.length)
  if (token.length === 0 || token !== expectedToken) {
    return err({ code: 'AUTH_FAILED', message: 'Invalid token' })
  }

  return ok(true)
}
