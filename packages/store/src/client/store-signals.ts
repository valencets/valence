import { signal } from '@valencets/reactive'
import type { Signal } from '@valencets/reactive'
import type { StoreFieldConfig } from '../fields/store-field-types.js'
import type { StoreState, StoreValue } from '../types.js'

export interface StoreSignals {
  [field: string]: Signal<StoreValue>
}

function resolveInitialValue (field: StoreFieldConfig, initialState: StoreState): StoreValue {
  const stateValue = initialState[field.name]
  if (stateValue !== undefined) return stateValue
  if ('default' in field && field.default !== undefined) return field.default as StoreValue
  return undefined
}

export function createStoreSignals (
  fields: readonly StoreFieldConfig[],
  initialState: StoreState
): StoreSignals {
  const signals: StoreSignals = {}

  for (const f of fields) {
    const initial = resolveInitialValue(f, initialState)
    signals[f.name] = signal(initial)
  }

  return signals
}
