import { ResultAsync } from '@valencets/resultkit'
import { StoreErrorCode } from '../types.js'
import type { StoreError, MutationPool } from '../types.js'

/**
 * #341 — hard-delete expired anonymous rows for one store. Anonymous
 * persisted buckets are keyed by signed session ids that nothing revokes,
 * so without retention the table grows forever. The predicate spares
 * `user:*` keys (user state must never expire) and `__global__` (the
 * shared copy), so only anonymous session buckets are ever swept.
 */
const PRUNE_SQL = `DELETE FROM store_states
WHERE store_slug = $1
  AND updated_at < NOW() - make_interval(days => $2)
  AND state_key NOT LIKE 'user:%'
  AND state_key <> '__global__'`

export function pruneExpiredStates (
  pool: MutationPool,
  slug: string,
  retentionDays: number
): ResultAsync<void, StoreError> {
  return ResultAsync.fromPromise(
    pool.query(PRUNE_SQL, [slug, retentionDays]),
    (e): StoreError => ({
      code: StoreErrorCode.STATE_ERROR,
      message: `Retention sweep failed for store '${slug}': ${e instanceof Error ? e.message : 'unknown'}`
    })
  ).map(() => undefined)
}
