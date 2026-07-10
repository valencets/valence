import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'

/**
 * Production gate for CMS_SECRET (#339). The secret signs anonymous store
 * sessions (HMAC-SHA256) and underpins session security — a missing,
 * default, or trivially short value must refuse to boot rather than run
 * silently forgeable.
 */

export const SecretErrorCode = Object.freeze({
  MISSING: 'MISSING',
  KNOWN_DEFAULT: 'KNOWN_DEFAULT',
  TOO_SHORT: 'TOO_SHORT'
} as const)

export type SecretErrorCode = typeof SecretErrorCode[keyof typeof SecretErrorCode]

export interface SecretError {
  readonly code: SecretErrorCode
  readonly message: string
}

export const MIN_SECRET_LENGTH = 32

// Values the framework itself has ever suggested: the runDev fallback and
// the .env.example placeholder. Both are public knowledge — running
// production with either means every signed session is forgeable.
const KNOWN_DEFAULTS: ReadonlySet<string> = Object.freeze(new Set(['dev-secret', 'change-me']))

const REGENERATE_HINT = 'Generate one with: node -e "console.log(require(\'node:crypto\').randomBytes(32).toString(\'hex\'))"'

export function validateProductionSecret (secret: string | undefined): Result<string, SecretError> {
  if (secret === undefined || secret === '') {
    return err({
      code: SecretErrorCode.MISSING,
      message: `CMS_SECRET must be set in .env for production. ${REGENERATE_HINT}`
    })
  }

  if (KNOWN_DEFAULTS.has(secret)) {
    return err({
      code: SecretErrorCode.KNOWN_DEFAULT,
      message: `CMS_SECRET is the known default "${secret}" — production requires a unique secret. ${REGENERATE_HINT}`
    })
  }

  if (secret.length < MIN_SECRET_LENGTH) {
    return err({
      code: SecretErrorCode.TOO_SHORT,
      message: `CMS_SECRET must be at least ${MIN_SECRET_LENGTH} characters, got ${secret.length}. ${REGENERATE_HINT}`
    })
  }

  return ok(secret)
}
