import type { StoreValue } from '../types.js'

interface DelegationStore {
  readonly mutations: { [name: string]: (args: { [key: string]: StoreValue }) => Promise<{ isOk: () => boolean; isErr: () => boolean }> }
  readonly signals: { [name: string]: { value: StoreValue } }
}

interface DelegationHandle {
  destroy (): void
}

function parseArgs (el: Element): { [key: string]: StoreValue } {
  const raw = el.getAttribute('data-args')
  if (!raw) return {}
  return JSON.parse(raw) as { [key: string]: StoreValue }
}

export function initMutationDelegation (
  root: HTMLElement,
  stores: { [slug: string]: DelegationStore }
): DelegationHandle {
  function handleClick (event: Event): void {
    if (!(event.target instanceof Element)) return

    const trigger = event.target.closest('[data-mutation]')
    if (!trigger) return

    const storeSlug = trigger.getAttribute('data-store')
    if (!storeSlug) return

    const store = stores[storeSlug]
    if (!store) return

    const mutationName = trigger.getAttribute('data-mutation')
    if (!mutationName) return

    const mutationFn = store.mutations[mutationName]
    if (!mutationFn) return

    const args = parseArgs(trigger)

    trigger.classList.add('is-pending')

    mutationFn(args).then((result) => {
      trigger.classList.remove('is-pending')
    })
  }

  root.addEventListener('click', handleClick)

  return {
    destroy () {
      root.removeEventListener('click', handleClick)
    }
  }
}
