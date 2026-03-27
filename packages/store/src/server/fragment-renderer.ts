import { err, fromThrowable } from '@valencets/resultkit'
import type { Result } from '@valencets/resultkit'
import type { StoreDefinition, StoreState, StoreError } from '../types.js'
import { StoreErrorCode } from '../types.js'

interface FragmentOutput {
  readonly selector: string
  readonly html: string
}

export function renderStoreFragment (
  config: StoreDefinition,
  state: StoreState
): Result<FragmentOutput, StoreError> {
  if (!config.fragment) {
    return err({
      code: StoreErrorCode.STATE_ERROR,
      message: `Store '${config.slug}' has no fragment render function`
    })
  }

  const selector = `[data-store="${config.slug}"]`

  const fragmentFn = config.fragment
  const safeRender = fromThrowable(
    (s: StoreState) => fragmentFn(s),
    (e): StoreError => ({
      code: StoreErrorCode.STATE_ERROR,
      message: e instanceof Error ? e.message : `Fragment render failed for store '${config.slug}'`
    })
  )

  return safeRender(state).map((html) => ({ selector, html }))
}
