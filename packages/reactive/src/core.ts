// @valencets/reactive — Core signal primitives.
// TC39-aligned pull/push algorithm with Preact-style .value accessor.

export interface SignalOptions<T> {
  readonly equals?: (prev: T, next: T) => boolean
}

export interface Signal<T> {
  value: T
  peek (): T
  /** @internal — subscribe to raw notifications. Use effect() for tracked subscriptions. */
  _subscribe (fn: () => void): () => void
}

export interface ReadonlySignal<T> {
  readonly value: T
  peek (): T
}

// Placeholder — signal() not yet implemented
export function signal<T> (_value: T, _options?: SignalOptions<T>): Signal<T> {
  // Phase 1: implement
  return undefined as unknown as Signal<T>
}
