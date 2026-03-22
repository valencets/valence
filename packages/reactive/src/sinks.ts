// @valencets/reactive — CMS field sinks and condition bridge.

import type { Signal, ReadonlySignal } from './core.js'

export interface FieldSink<T> {
  readonly value: Signal<T>
  readonly visible: Signal<boolean>
  readonly error: Signal<string | null>
}

// Placeholder
export function fieldSink<T> (_initial: T): FieldSink<T> {
  return undefined as unknown as FieldSink<T>
}

// Placeholder
export function condition<T extends readonly Signal<unknown>[]> (
  _deps: [...T],
  _fn: (...vals: { [K in keyof T]: T[K] extends Signal<infer V> ? V : never }) => boolean
): ReadonlySignal<boolean> {
  return undefined as unknown as ReadonlySignal<boolean>
}
