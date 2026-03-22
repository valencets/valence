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

// --- Tracking scope ---

let currentScope: (() => void) | null = null
// Set of subscriber-sets that the current scope has been added to.
// Used by effect() to remove itself from old dependencies on re-run.
let currentCleanups: Array<Set<() => void>> | null = null

// --- effect() ---

export function effect (fn: () => undefined | void | (() => void)): () => void {
  let userCleanup: (() => void) | undefined
  let disposed = false
  let running = false
  // All subscriber sets this effect has been added to
  let trackedSets: Array<Set<() => void>> = []

  function run (): void {
    if (disposed || running) return
    running = true

    // Run previous user cleanup
    if (userCleanup !== undefined) {
      userCleanup()
      userCleanup = undefined
    }

    // Remove from all old subscriber sets
    for (const set of trackedSets) {
      set.delete(run)
    }
    trackedSets = []

    // Execute fn with tracking — signals/computeds will add `run` to their subscriber sets
    // and register those sets in currentCleanups for future removal
    const prevScope = currentScope
    const prevCleanups = currentCleanups
    currentScope = run
    currentCleanups = trackedSets
    const result = fn()
    currentScope = prevScope
    currentCleanups = prevCleanups

    if (typeof result === 'function') {
      userCleanup = result
    }

    running = false
  }

  run()

  return () => {
    if (disposed) return
    disposed = true
    if (userCleanup !== undefined) {
      userCleanup()
      userCleanup = undefined
    }
    for (const set of trackedSets) {
      set.delete(run)
    }
    trackedSets = []
  }
}

// --- computed() ---

const DIRTY = 1
const CLEAN = 0

export function computed<T> (fn: () => T, options?: SignalOptions<T>): ReadonlySignal<T> {
  let value: T
  let state: 0 | 1 = DIRTY
  const equals = options?.equals ?? Object.is
  const subscribers = new Set<() => void>()

  function recompute (): void {
    const prevScope = currentScope
    const prevCleanups = currentCleanups
    currentScope = markDirty
    currentCleanups = null // computeds don't need cleanup tracking
    const next = fn()
    currentScope = prevScope
    currentCleanups = prevCleanups
    if (state === CLEAN && equals(value, next)) return
    value = next
    state = CLEAN
  }

  function markDirty (): void {
    if (state === DIRTY) return
    state = DIRTY
    const snapshot = [...subscribers]
    for (const sub of snapshot) {
      sub()
    }
  }

  const obj: ReadonlySignal<T> = {
    get value (): T {
      if (state === DIRTY) {
        recompute()
      }
      if (currentScope !== null) {
        subscribers.add(currentScope)
        if (currentCleanups !== null) {
          currentCleanups.push(subscribers)
        }
      }
      return value
    },

    peek (): T {
      if (state === DIRTY) {
        recompute()
      }
      return value
    }
  }

  return Object.freeze(obj)
}

// --- signal() ---

export function signal<T> (initialValue: T, options?: SignalOptions<T>): Signal<T> {
  let value = initialValue
  const equals = options?.equals ?? Object.is
  const subscribers = new Set<() => void>()

  const sig: Signal<T> = {
    get value (): T {
      if (currentScope !== null) {
        subscribers.add(currentScope)
        if (currentCleanups !== null) {
          currentCleanups.push(subscribers)
        }
      }
      return value
    },

    set value (next: T) {
      if (equals(value, next)) return
      value = next
      // Snapshot to avoid infinite loop from concurrent add/delete during iteration
      const snapshot = [...subscribers]
      for (const fn of snapshot) {
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
