import { ResultAsync } from '@valencets/resultkit'
import type { DbPool } from '@valencets/db'
import { CmsErrorCode } from '../schema/types.js'
import type { CmsError } from '../schema/types.js'
import type { SqlValue } from './query-types.js'

export function safeQuery<T> (
  pool: DbPool,
  queryStr: string,
  params: readonly SqlValue[]
): ResultAsync<T, CmsError> {
  return ResultAsync.fromPromise(
    pool.sql.unsafe(queryStr, params as SqlValue[]).then((rows) => rows as T),
    (e: unknown): CmsError => ({
      code: CmsErrorCode.INTERNAL,
      message: e instanceof Error ? e.message : 'Query failed'
    })
  )
}
