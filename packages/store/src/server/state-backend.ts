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
}
