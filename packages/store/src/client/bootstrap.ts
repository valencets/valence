import { store } from '../index.js'
import type { StoreInput, StoreDefinition } from '../types.js'
import { createStoreClient } from './store-client.js'
import type { StoreClient } from './store-client.js'
import { createPostMutation } from './post-mutation.js'
import type { PostMutationFn } from './post-mutation.js'
import { readHydrationState } from './hydration.js'
import { reconcileFragment } from './fragment-reconciler.js'
import { SSEListener } from './sse-listener.js'
import { initMutationDelegation } from './mutation-delegate.js'
import { initFieldBinding } from './field-binding.js'
import { fragmentSelector } from '../fragment-selector.js'
import type { StoreState } from '../types.js'

export interface InitStoresOptions {
  /** Delegation root — defaults to document.body */
  readonly root?: HTMLElement
  /** Transport override, mainly for tests — defaults to the fetch transport */
  readonly postMutation?: PostMutationFn
}

export interface StoresHandle {
  readonly stores: { [slug: string]: StoreClient }
  readonly dispose: () => void
}

function acceptDefinition (input: StoreInput | StoreDefinition): StoreDefinition | null {
  const result = store(input)
  return result.isOk() ? result.value : null
}

/**
 * Boot the store runtime for a server-rendered page:
 *
 * 1. Validate definitions (invalid ones are skipped — they would have been
 *    skipped server-side too).
 * 2. Seed signals from inline <script data-store-hydrate> tags.
 * 3. Open one SSE channel per store that both has a server (scope !== page)
 *    and is bound to at least one [data-store] element on the page; route
 *    state events into signal reconciliation and fragment events into swaps.
 * 4. Delegate [data-mutation] clicks at the root.
 */
function renderInitialFragment (config: StoreDefinition, client: StoreClient): void {
  const fragmentFn = config.fragment
  if (fragmentFn === undefined) return
  const selector = fragmentSelector(config.slug)
  if (document.querySelector(selector) === null) return
  const state: StoreState = {}
  for (const f of config.fields) {
    state[f.name] = client.signals[f.name]?.value
  }
  reconcileFragment({ selector, html: fragmentFn(state) })
}

export function initStores (
  definitions: ReadonlyArray<StoreInput | StoreDefinition>,
  options?: InitStoresOptions
): StoresHandle {
  const stores: { [slug: string]: StoreClient } = {}
  const configs: { [slug: string]: StoreDefinition } = {}
  const listeners: SSEListener[] = []
  const postMutation = options?.postMutation ?? createPostMutation()

  for (const input of definitions) {
    const config = acceptDefinition(input)
    if (config === null) continue

    const hydration = readHydrationState(config.slug)
    const client = createStoreClient(config, hydration, postMutation, {
      onFragment: (fragment) => { reconcileFragment(fragment) }
    })
    stores[config.slug] = client
    configs[config.slug] = config

    // Fragment mode paints on first load too, not only after a mutation —
    // the fragment fn is client-safe by contract.
    renderInitialFragment(config, client)

    // Page scope never talks to a server; other scopes only hold a connection
    // while the page actually renders something bound to the store.
    const bound = document.querySelector(`[data-store="${config.slug}"]`) !== null ||
      document.querySelector(`[data-fragment="${config.slug}"]`) !== null
    if (config.scope !== 'page' && bound) {
      const listener = SSEListener.create(`/store/${config.slug}/events`)
      listener.onState((state) => { client.applyServerState(state) })
      listener.onFragment((fragment) => { reconcileFragment(fragment) })
      listeners.push(listener)
    }
  }

  const root = options?.root ?? document.body
  const delegation = initMutationDelegation(root, stores)
  const fieldBinding = initFieldBinding(root, stores, configs)

  return {
    stores,
    dispose () {
      fieldBinding.destroy()
      delegation.destroy()
      for (const listener of listeners) {
        listener.disconnect()
      }
      for (const client of Object.values(stores)) {
        client.dispose()
      }
    }
  }
}
