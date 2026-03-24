// @valencets/reactive — Core signal primitives.
// TC39-aligned pull/push algorithm with Preact-style .value accessor.
//
// INVARIANT: Callbacks passed to effect(), computed(), batch(), untracked()
// MUST NOT throw. Valence uses Result monads for error handling — wrap
// fallible operations in fromThrowable() or ResultAsync. A thrown exception
// corrupts internal state (notify depth, pending sets) and is a caller bug.

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

// --- Batching ---

let batchDepth = 0
const batchQueue = new Set<() => void>()

export function batch<T> (fn: () => T): T {
  batchDepth++
  const result = fn()
  batchDepth--
  if (batchDepth === 0) {
    const queued = [...batchQueue]
    batchQueue.clear()
    for (const sub of queued) {
      sub()
    }
  }
  return result
}

// --- Notification ---
// All notifications go through a single queue to avoid recursive snapshot allocations.
// Subscribers are collected into the queue and flushed once per microtask or batch.

let notifyDepth = 0
const MAX_NOTIFY_DEPTH = 100
let pendingNotify: Set<() => void> | null = null

function enqueue (subscribers: Set<() => void>): void {
  if (batchDepth > 0) {
    for (const fn of subscribers) {
      batchQueue.add(fn)
    }
    return
  }
  // If we're already inside a notify, collect into pending set (avoids snapshot allocation)
  if (pendingNotify !== null) {
    for (const fn of subscribers) {
      pendingNotify.add(fn)
    }
    return
  }
  if (++notifyDepth > MAX_NOTIFY_DEPTH) {
    notifyDepth = 0
    if (typeof console !== 'undefined') {
      console.warn('@valencets/reactive: maximum notify depth exceeded (possible infinite signal loop)')
    }
    return
  }
  // Process subscribers — new notifications during processing go to pendingNotify
  pendingNotify = new Set()
  const snapshot = [...subscribers]
  for (const fn of snapshot) {
    fn()
  }
  // Drain pending until empty
  while (pendingNotify.size > 0) {
    const next = [...pendingNotify]
    pendingNotify.clear()
    for (const fn of next) {
      fn()
    }
  }
  pendingNotify = null
  notifyDepth--
}

// --- untracked() ---

export function untracked<T> (fn: () => T): T {
  const prevScope = currentScope
  const prevCleanups = currentCleanups
  currentScope = null
  currentCleanups = null
  const result = fn()
  currentScope = prevScope
  currentCleanups = prevCleanups
  return result
}

// --- Tracking scope ---

let currentScope: (() => void) | null = null
let currentCleanups: Array<Set<() => void>> | null = null

// --- effect() ---

export function effect (fn: () => undefined | void | (() => void)): () => void {
  let userCleanup: (() => void) | undefined
  let disposed = false
  let running = false
  let trackedSets: Array<Set<() => void>> = []

  function run (): void {
    if (disposed) return
    if (running) {
      if (typeof console !== 'undefined') {
        console.warn('@valencets/reactive: effect() re-entered itself — update dropped')
      }
      return
    }
    running = true

    if (userCleanup !== undefined) {
      userCleanup()
      userCleanup = undefined
    }

    for (const set of trackedSets) {
      set.delete(run)
    }
    trackedSets = []

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

const ComputedState = { DIRTY: 1, CLEAN: 0 } as const
type ComputedState = typeof ComputedState[keyof typeof ComputedState]

export function computed<T> (fn: () => T, options?: SignalOptions<T>): ReadonlySignal<T> {
  let value: T | undefined
  let hasValue = false
  let state: ComputedState = ComputedState.DIRTY
  const equals = options?.equals ?? Object.is
  const subscribers = new Set<() => void>()
  let sourceSets: Array<Set<() => void>> = []

  function recompute (): void {
    for (const set of sourceSets) {
      set.delete(markDirty)
    }
    sourceSets = []

    const prevScope = currentScope
    const prevCleanups = currentCleanups
    currentScope = markDirty
    currentCleanups = sourceSets
    const next = fn()
    currentScope = prevScope
    currentCleanups = prevCleanups
    state = ComputedState.CLEAN
    if (hasValue && equals(value as T, next)) return
    value = next
    hasValue = true
  }

  function markDirty (): void {
    if (state === ComputedState.DIRTY) return
    state = ComputedState.DIRTY
    enqueue(subscribers)
  }

  const obj: ReadonlySignal<T> = {
    get value (): T {
      if (state === ComputedState.DIRTY) {
        recompute()
      }
      if (currentScope !== null) {
        subscribers.add(currentScope)
        if (currentCleanups !== null) {
          currentCleanups.push(subscribers)
        }
      }
      return value as T
    },

    peek (): T {
      if (state === ComputedState.DIRTY) {
        recompute()
      }
      return value as T
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
      enqueue(subscribers)
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
