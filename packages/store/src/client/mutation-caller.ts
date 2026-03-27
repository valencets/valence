import { ok, err } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { ZodObject, ZodTypeAny } from 'zod'
import type { StoreSignals } from './store-signals.js'
import type { PendingQueue } from './pending-queue.js'
import type { StoreState, StoreError, StoreValue } from '../types.js'
import { StoreErrorCode } from '../types.js'
import { reconcileState } from './reconciler.js'

interface PostMutationResponse {
  readonly ok: boolean
  readonly state?: StoreState
  readonly confirmedId?: number
  readonly error?: { readonly code: string; readonly message: string }
}

type PostMutationFn = (
  storeSlug: string,
  mutationName: string,
  args: { [key: string]: StoreValue },
  mutationId: number
) => Promise<PostMutationResponse>

type ClientFn = (state: StoreState, input: { [key: string]: StoreValue }) => void

interface MutationCallerConfig {
  readonly storeSlug: string
  readonly mutationName: string
  readonly inputSchema: ZodObject<Record<string, ZodTypeAny>>
  readonly signals: StoreSignals
  readonly pendingQueue: PendingQueue
  readonly postMutation: PostMutationFn
  readonly clientFn?: ClientFn
  readonly serverState?: StoreState
}

export function createMutationCaller (
  config: MutationCallerConfig
): (args: { [key: string]: StoreValue }) => Promise<Result<void, StoreError>> {
  const clientFns = new Map<number, (state: StoreState) => void>()
  let lastKnownServerState: StoreState = config.serverState ?? {}

  return async (args) => {
    // Step 1: Validate input
    const validation = config.inputSchema.safeParse(args)
    if (!validation.success) {
      return err({
        code: StoreErrorCode.VALIDATION_FAILED,
        message: validation.error.message
      })
    }

    // Step 2: Enqueue mutation
    const mutationId = config.pendingQueue.enqueue(config.mutationName, args as { [key: string]: string | number | boolean | null })

    // Step 3: Optimistic apply (if client function provided)
    if (config.clientFn) {
      const localState: StoreState = {}
      for (const key of Object.keys(config.signals)) {
        localState[key] = config.signals[key]!.value
      }
      config.clientFn(localState, args)

      // Register for replay during reconciliation
      const boundFn = (state: StoreState) => config.clientFn!(state, args)
      clientFns.set(mutationId, boundFn)

      // Apply to signals
      for (const key of Object.keys(localState)) {
        const sig = config.signals[key]
        if (sig) sig.value = localState[key]
      }
    }

    // Step 4: POST to server
    const response = await config.postMutation(
      config.storeSlug,
      config.mutationName,
      args,
      mutationId
    )

    // Step 5: Reconcile
    if (response.ok && response.state) {
      lastKnownServerState = response.state
      reconcileState(config.signals, response.state, config.pendingQueue, response.confirmedId, clientFns)
      clientFns.delete(mutationId)
      return ok(undefined)
    }

    // Step 6: Rollback on failure
    config.pendingQueue.reject(mutationId)
    clientFns.delete(mutationId)

    // Restore to last known server state + replay remaining pending
    reconcileState(config.signals, lastKnownServerState, config.pendingQueue, undefined, clientFns)

    return err({
      code: (response.error?.code as StoreErrorCode) ?? StoreErrorCode.MUTATION_FAILED,
      message: response.error?.message ?? `Mutation '${config.mutationName}' failed`
    })
  }
}
