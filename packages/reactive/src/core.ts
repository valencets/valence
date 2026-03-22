// @valencets/reactive — Core signal primitives.
// TC39-aligned pull/push algorithm with Preact-style .value accessor.
//
// Subscriber references: currently STRONG (Set<() => void>).
// Phase 7 will evaluate WeakRef for automatic GC of orphaned computeds/effects.
// Strong refs are correct for now — all subscribers are explicitly disposed
// via unsubscribe or effect dispose functions.

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

// --- Tracking scope (used by computed/effect in later phases) ---

let currentScope: (() => void) | null = null

/** @internal — get the current tracking scope for dependency registration. */
export function _getCurrentScope (): (() => void) | null {
  return currentScope
}

/** @internal — set the current tracking scope. */
export function _setCurrentScope (scope: (() => void) | null): void {
  currentScope = scope
}

// --- signal() ---

export function signal<T> (initialValue: T, options?: SignalOptions<T>): Signal<T> {
  let value = initialValue
  const equals = options?.equals ?? Object.is
  // Strong references — see comment at top of file
  const subscribers = new Set<() => void>()

  const sig: Signal<T> = {
    get value (): T {
      // Register dependency if inside a tracking scope
      if (currentScope !== null) {
        subscribers.add(currentScope)
      }
      return value
    },

    set value (next: T) {
      if (equals(value, next)) return
      value = next
      for (const fn of subscribers) {
        fn()
      }
    },

    peek (): T {
      return value
    },

    _subscribe (fn: () => void): () => void {
      subscribers.add(fn)
      return () => { subscribers.delete(fn) }
    }
  }

  return sig
}
