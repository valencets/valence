import { computed } from '@valencets/reactive'
import type { Result } from '@valencets/resultkit'
import type { ReadonlySignal } from '@valencets/reactive'
import type { StoreDefinition, StoreState, StoreError, StoreValue } from '../types.js'
import { createStoreSignals } from './store-signals.js'
import type { StoreSignals } from './store-signals.js'
import { PendingQueue } from './pending-queue.js'
import { createMutationCaller } from './mutation-caller.js'
import type { ServerStateRef } from './mutation-caller.js'
import { reconcileState } from './reconciler.js'
import { generateStoreSchema } from '../validation/zod-generator.js'
import type { PostMutationFn } from './post-mutation.js'

type MutationFn = (args: { [key: string]: StoreValue }) => Promise<Result<void, StoreError>>

export interface StoreClientOptions {
  readonly onFragment?: (fragment: { readonly selector: string; readonly html: string }) => void
}

export interface StoreClient {
  readonly signals: StoreSignals
  readonly mutations: { [name: string]: MutationFn }
  readonly derived: { [name: string]: ReadonlySignal<StoreValue> }
  readonly pendingCount: number
  /** Apply authoritative server state pushed over SSE — replays pending on top */
  readonly applyServerState: (state: StoreState) => void
  readonly dispose: () => void
}

export function createStoreClient (
  config: StoreDefinition,
  hydrationState: StoreState,
  postMutation: PostMutationFn,
  options?: StoreClientOptions
): StoreClient {
  const signals = createStoreSignals(config.fields, hydrationState)
  const pendingQueue = PendingQueue.create()
  const mutations: { [name: string]: MutationFn } = {}

  // One rebase context per store: rollback restores field defaults + hydration
  // (the signals' initial values), and every caller shares the same replay map
  // so mixed pending mutations rebase together regardless of name.
  const initialState: StoreState = {}
  for (const key of Object.keys(signals)) {
    initialState[key] = signals[key]!.value
  }
  const serverStateRef: ServerStateRef = { current: initialState }
  const sharedClientFns = new Map<number, (state: StoreState) => void>()

  for (const [name, mutation] of Object.entries(config.mutations)) {
    const inputSchema = generateStoreSchema(mutation.input)

    const callerConfig = {
      storeSlug: config.slug,
      mutationName: name,
      inputSchema,
      signals,
      pendingQueue,
      postMutation,
      sharedClientFns,
      serverStateRef,
      ...(options?.onFragment ? { onFragment: options.onFragment } : {}),
      ...(mutation.client
        ? {
            clientFn: (state: StoreState, input: { [key: string]: StoreValue }) => {
              mutation.client!({ state, input })
            }
          }
        : {})
    }

    mutations[name] = createMutationCaller(callerConfig)
  }

  // Derived definitions become auto-tracking computed signals: reading every
  // field signal inside the computed body subscribes it to the whole store.
  const derived: { [name: string]: ReadonlySignal<StoreValue> } = {}
  for (const [name, deriveFn] of Object.entries(config.derived ?? {})) {
    derived[name] = computed(() => {
      const snapshot: StoreState = {}
      for (const key of Object.keys(signals)) {
        snapshot[key] = signals[key]!.value
      }
      return deriveFn(snapshot)
    })
  }

  return {
    signals,
    mutations,
    derived,
    get pendingCount () {
      return pendingQueue.size
    },
    applyServerState (state: StoreState) {
      serverStateRef.current = state
      reconcileState(signals, state, pendingQueue, undefined, sharedClientFns)
    },
    dispose () {
      pendingQueue.clear()
      sharedClientFns.clear()
    }
  }
}
