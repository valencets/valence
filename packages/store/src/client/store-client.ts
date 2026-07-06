import type { Result } from '@valencets/resultkit'
import type { StoreDefinition, StoreState, StoreError, StoreValue } from '../types.js'
import { createStoreSignals } from './store-signals.js'
import type { StoreSignals } from './store-signals.js'
import { PendingQueue } from './pending-queue.js'
import { createMutationCaller } from './mutation-caller.js'
import type { ServerStateRef } from './mutation-caller.js'
import { generateStoreSchema } from '../validation/zod-generator.js'

type PostMutationFn = (
  storeSlug: string,
  mutationName: string,
  args: { [key: string]: StoreValue },
  mutationId: number
) => Promise<{
  readonly ok: boolean
  readonly state?: StoreState
  readonly confirmedId?: number
  readonly error?: { readonly code: string; readonly message: string }
}>

type MutationFn = (args: { [key: string]: StoreValue }) => Promise<Result<void, StoreError>>

interface StoreClient {
  readonly signals: StoreSignals
  readonly mutations: { [name: string]: MutationFn }
  readonly pendingCount: number
  readonly dispose: () => void
}

export function createStoreClient (
  config: StoreDefinition,
  hydrationState: StoreState,
  postMutation: PostMutationFn
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

  return {
    signals,
    mutations,
    get pendingCount () {
      return pendingQueue.size
    },
    dispose () {
      pendingQueue.clear()
      sharedClientFns.clear()
    }
  }
}
