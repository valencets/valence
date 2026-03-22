// @valencets/reactive — CMS field sinks and condition bridge.

import type { Signal, ReadonlySignal } from './core.js'
import { signal, computed } from './core.js'

export interface FieldSink<T> {
  readonly value: Signal<T>
  readonly visible: Signal<boolean>
  readonly error: Signal<string | null>
}

/** Create a field sink with value, visible, and error signals. */
export function fieldSink<T> (initial: T): FieldSink<T> {
  return {
    value: signal(initial),
    visible: signal(true),
    error: signal<string | null>(null)
  }
}

/** Bridge a condition config to a computed boolean signal.
 *  Reads all deps inside a computed — auto-tracks them. */
export function condition<D extends readonly Signal<never>[]> (
  deps: readonly [...D],
  fn: (...vals: { [K in keyof D]: D[K] extends Signal<infer V> ? V : never }) => boolean
): ReadonlySignal<boolean> {
  return computed(() => {
    // Build args tuple by reading each dep — tracked by the computed
    const args: Array<never> = []
    for (let i = 0; i < deps.length; i++) {
      const dep = deps[i]
      if (dep !== undefined) {
        args.push(dep.value)
      }
    }
    return (fn as (...a: Array<never>) => boolean)(...args)
  })
}
