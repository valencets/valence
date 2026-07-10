import type { StoreState } from '../types.js'

/**
 * Structural contract for store state storage. The in-memory
 * SessionStateHolder satisfies it synchronously; database-backed holders
 * return promises. Consumers await both — `await` on a plain value is a
 * no-op, so the sync path pays nothing.
 */
export interface StateBackend {
  getState (key: string): StoreState | Promise<StoreState>
  setState (key: string, state: StoreState): void | Promise<void>
  /**
   * Optional atomic read-modify-write under a storage-level lock (#336).
   * Backends that can lock (postgres row locks) expose it so mutations from
   * several nodes sharing one database serialize on the bucket row instead
   * of relying on the in-process lock alone. The mutation handler prefers
   * this path whenever it exists.
   */
  update? (key: string, mutate: (state: StoreState) => Promise<StoreState>): Promise<StoreState>
}
