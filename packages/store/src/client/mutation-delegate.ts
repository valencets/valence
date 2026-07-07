import { fromThrowable } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { StoreValue } from '../types.js'

interface DelegationStore {
  readonly mutations: { [name: string]: (args: { [key: string]: StoreValue }) => Promise<{ isOk: () => boolean; isErr: () => boolean }> }
  readonly signals: { [name: string]: { value: StoreValue } }
}

interface DelegationHandle {
  destroy (): void
}

const safeJsonParse = fromThrowable(
  (raw: string) => JSON.parse(raw) as { [key: string]: StoreValue },
  () => null
)

// Malformed data-args markup yields an Err instead of throwing inside the
// click handler — the trigger is skipped rather than crashing delegation.
function parseArgs (el: Element): Result<{ [key: string]: StoreValue }, null> {
  const raw = el.getAttribute('data-args')
  if (!raw) return safeJsonParse('{}')
  return safeJsonParse(raw)
}

export function initMutationDelegation (
  root: HTMLElement,
  stores: { [slug: string]: DelegationStore }
): DelegationHandle {
  function handleClick (event: Event): void {
    if (!(event.target instanceof Element)) return

    const trigger = event.target.closest('[data-mutation]')
    if (!trigger) return

    // The store comes from the trigger itself or the nearest data-store
    // container — declare the slug once, not on every button.
    const storeSlug = trigger.getAttribute('data-store') ??
      trigger.closest('[data-store]')?.getAttribute('data-store') ?? null
    if (!storeSlug) return

    const store = stores[storeSlug]
    if (!store) return

    const mutationName = trigger.getAttribute('data-mutation')
    if (!mutationName) return

    const mutationFn = store.mutations[mutationName]
    if (!mutationFn) return

    const argsResult = parseArgs(trigger)
    if (argsResult.isErr() || argsResult.value === null) return

    // LiveView-style optimistic affordance: is-pending applies instantly and
    // resolves with the server response; failures surface as is-error until
    // the next attempt.
    trigger.classList.remove('is-error')
    trigger.classList.add('is-pending')

    mutationFn(argsResult.value).then(
      (result) => {
        trigger.classList.remove('is-pending')
        if (result.isErr()) {
          trigger.classList.add('is-error')
        }
      },
      () => {
        trigger.classList.remove('is-pending')
        trigger.classList.add('is-error')
      }
    )
  }

  root.addEventListener('click', handleClick)

  return {
    destroy () {
      root.removeEventListener('click', handleClick)
    }
  }
}
