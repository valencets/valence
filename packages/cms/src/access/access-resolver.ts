import { ResultAsync } from 'neverthrow'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { WhereClause } from '../db/query-types.js'
import type { AccessControlFunction, AccessArgs } from './access-types.js'

export function resolveAccess (
  accessFn: AccessControlFunction | undefined,
  args: AccessArgs
): ResultAsync<boolean | WhereClause, CmsError> {
  if (accessFn === undefined) {
    return ResultAsync.fromSafePromise(Promise.resolve(true as boolean | WhereClause))
  }

  return ResultAsync.fromPromise(
    Promise.resolve().then(() => accessFn(args)),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'Access check failed'
    })
  )
}
