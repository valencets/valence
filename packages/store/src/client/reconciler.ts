import { batch } from '@valencets/reactive'
import type { StoreSignals } from './store-signals.js'
import type { PendingQueue } from './pending-queue.js'
import type { StoreState } from '../types.js'

/**
 * Reconcile client signals with authoritative server state.
 *
 * 1. Drop the confirmed mutation from the pending queue (if confirmedId provided)
 * 2. Apply server state to signals
 * 3. Replay remaining pending mutations' client functions on top
 *
 * Wrapped in batch() so all signal updates trigger a single DOM flush.
 */
export function reconcileState (
  signals: StoreSignals,
  serverState: StoreState,
  pendingQueue: PendingQueue,
  confirmedId?: number,
  clientFns?: Map<number, (state: StoreState) => void>
): void {
  batch(() => {
    // Step 1: drop confirmed mutation
    if (confirmedId !== undefined) {
      pendingQueue.confirm(confirmedId)
    }

    // Step 2: apply server state to signals
    for (const key of Object.keys(serverState)) {
      const sig = signals[key]
      if (sig !== undefined) {
        sig.value = serverState[key]
      }
    }

    // Step 3: replay remaining pending mutations' client functions
    if (clientFns && pendingQueue.size > 0) {
      // Build a mutable state snapshot from current signal values
      const localState: StoreState = {}
      for (const key of Object.keys(signals)) {
        localState[key] = signals[key]!.value
      }

      // Replay each pending mutation's client function
      for (const pending of pendingQueue.pending()) {
        const fn = clientFns.get(pending.id)
        if (fn) {
          fn(localState)
        }
      }

      // Apply replayed state back to signals
      for (const key of Object.keys(localState)) {
        const sig = signals[key]
        if (sig !== undefined) {
          sig.value = localState[key]
        }
      }
    }
  })
}
