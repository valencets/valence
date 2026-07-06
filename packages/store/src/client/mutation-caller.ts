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
  readonly fragment?: { readonly selector: string; readonly html: string }
  readonly error?: { readonly code: string; readonly message: string }
}

type PostMutationFn = (
  storeSlug: string,
  mutationName: string,
  args: { [key: string]: StoreValue },
  mutationId: number
) => Promise<PostMutationResponse>

type ClientFn = (state: StoreState, input: { [key: string]: StoreValue }) => void

/** Rollback baseline shared by every mutation caller of one store client */
export interface ServerStateRef {
  current: StoreState
}

interface MutationCallerConfig {
  readonly storeSlug: string
  readonly mutationName: string
  readonly inputSchema: ZodObject<Record<string, ZodTypeAny>>
  readonly signals: StoreSignals
  readonly pendingQueue: PendingQueue
  readonly postMutation: PostMutationFn
  readonly clientFn?: ClientFn
  readonly serverState?: StoreState
  /** Shared across ALL of a store's callers so mixed pending mutations rebase together */
  readonly sharedClientFns?: Map<number, (state: StoreState) => void>
  readonly serverStateRef?: ServerStateRef
  /** Invoked with the server-rendered fragment when the POST response carries one */
  readonly onFragment?: (fragment: { readonly selector: string; readonly html: string }) => void
}

const KNOWN_ERROR_CODES: ReadonlySet<string> = new Set(Object.values(StoreErrorCode))

function toStoreErrorCode (code: string | undefined): StoreErrorCode {
  if (code !== undefined && KNOWN_ERROR_CODES.has(code)) {
    return code as StoreErrorCode
  }
  return StoreErrorCode.MUTATION_FAILED
}

export function createMutationCaller (
  config: MutationCallerConfig
): (args: { [key: string]: StoreValue }) => Promise<Result<void, StoreError>> {
  const clientFns = config.sharedClientFns ?? new Map<number, (state: StoreState) => void>()
  const stateRef: ServerStateRef = config.serverStateRef ?? { current: config.serverState ?? {} }

  return async (args) => {
    // Step 1: Validate input — Zod strips unknown keys, so only declared
    // input fields survive into the optimistic apply and the wire payload
    const validation = config.inputSchema.safeParse(args)
    if (!validation.success) {
      return err({
        code: StoreErrorCode.VALIDATION_FAILED,
        message: validation.error.message
      })
    }
    const input = validation.data as { [key: string]: StoreValue }

    // Step 2: Enqueue mutation
    const mutationId = config.pendingQueue.enqueue(config.mutationName, input as { [key: string]: string | number | boolean | null })

    // Step 3: Optimistic apply (if client function provided)
    if (config.clientFn) {
      const localState: StoreState = {}
      for (const key of Object.keys(config.signals)) {
        localState[key] = config.signals[key]!.value
      }
      config.clientFn(localState, input)

      // Register for replay during reconciliation
      const boundFn = (state: StoreState) => config.clientFn!(state, input)
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
      input,
      mutationId
    )

    // Step 5: Reconcile. This caller KNOWS which of its pending entries the
    // response settles — confirm the local id rather than trusting an echo.
    if (response.ok && response.state) {
      stateRef.current = response.state
      reconcileState(config.signals, response.state, config.pendingQueue, mutationId, clientFns)
      clientFns.delete(mutationId)
      if (response.fragment && config.onFragment) {
        config.onFragment(response.fragment)
      }
      return ok(undefined)
    }

    // Step 6: Rollback on failure
    config.pendingQueue.reject(mutationId)
    clientFns.delete(mutationId)

    // Restore to last known server state + replay remaining pending
    reconcileState(config.signals, stateRef.current, config.pendingQueue, undefined, clientFns)

    return err({
      code: toStoreErrorCode(response.error?.code),
      message: response.error?.message ?? `Mutation '${config.mutationName}' failed`
    })
  }
}
