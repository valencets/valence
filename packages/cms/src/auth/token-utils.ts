import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { ok, err, fromThrowable } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'

export const TokenErrorCode = Object.freeze({
  GENERATION_FAILED: 'GENERATION_FAILED',
  HASH_FAILED: 'HASH_FAILED'
} as const)

export type TokenErrorCode = typeof TokenErrorCode[keyof typeof TokenErrorCode]

export interface TokenError {
  readonly code: TokenErrorCode
  readonly message: string
}

/** Default token byte length (32 bytes → 64-char hex string). */
const DEFAULT_BYTE_LENGTH = 32

const safeRandomBytes = fromThrowable(
  (length: number) => randomBytes(length).toString('hex'),
  (e): TokenError => ({
    code: TokenErrorCode.GENERATION_FAILED,
    message: e instanceof Error ? e.message : 'Token generation failed'
  })
)

const safeCreateHash = fromThrowable(
  (token: string) => createHash('sha256').update(token).digest('hex'),
  (e): TokenError => ({
    code: TokenErrorCode.HASH_FAILED,
    message: e instanceof Error ? e.message : 'Token hashing failed'
  })
)

/**
 * Generate a cryptographically secure random token as a hex string.
 * @param length — number of random bytes (default 32, producing a 64-char hex string)
 */
export function generateToken (length = DEFAULT_BYTE_LENGTH): Result<string, TokenError> {
  return safeRandomBytes(length)
}

/**
 * Hash a token using SHA-256 for secure storage.
 * Never store raw tokens — always hash before persisting.
 */
export function hashToken (token: string): Result<string, TokenError> {
  return safeCreateHash(token)
}

/**
 * Verify a raw token against its stored SHA-256 hash using timing-safe comparison.
 * Returns Ok(true) if the token matches, Ok(false) otherwise.
 */
export function verifyToken (token: string, hash: string): Result<boolean, TokenError> {
  const hashResult = hashToken(token)
  if (hashResult.isErr()) return err(hashResult.error)

  const expected = hashResult.value
  if (expected.length !== hash.length) return ok(false)

  const expectedBuf = Buffer.from(expected, 'hex')
  const hashBuf = Buffer.from(hash, 'hex')

  if (expectedBuf.length !== hashBuf.length) return ok(false)

  return ok(timingSafeEqual(expectedBuf, hashBuf))
}
