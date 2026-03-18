import argon2 from 'argon2'
import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'

export function hashPassword (plain: string): ResultAsync<string, CmsError> {
  return ResultAsync.fromPromise(
    argon2.hash(plain, { type: argon2.argon2id }),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'Password hashing failed'
    })
  )
}

export function verifyPassword (plain: string, hash: string): ResultAsync<boolean, CmsError> {
  return ResultAsync.fromPromise(
    argon2.verify(hash, plain),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'Password verification failed'
    })
  )
}
