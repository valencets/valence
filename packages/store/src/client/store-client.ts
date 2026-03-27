import type { Result } from '@valencets/resultkit'
import type { StoreDefinition, StoreState, StoreError, StoreValue } from '../types.js'
import { createStoreSignals } from './store-signals.js'
import type { StoreSignals } from './store-signals.js'
import { PendingQueue } from './pending-queue.js'
import { createMutationCaller } from './mutation-caller.js'
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

  for (const [name, mutation] of Object.entries(config.mutations)) {
    const inputSchema = generateStoreSchema(mutation.input)

    const clientFn = mutation.client
      ? (state: StoreState, input: { [key: string]: StoreValue }) => {
          mutation.client!({ state, input })
        }
      : undefined

    mutations[name] = createMutationCaller({
      storeSlug: config.slug,
      mutationName: name,
      inputSchema,
      signals,
      pendingQueue,
      postMutation,
      clientFn,
      serverState: { ...hydrationState }
    })
  }

  return {
    signals,
    mutations,
    dispose () {
      pendingQueue.clear()
    }
  }
}
