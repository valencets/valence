# @valencets/reactive

Zero-dependency signals layer for the Valence admin UI. TC39-aligned pull-based computation with Preact-style `.value` accessors.

## Install

```bash
pnpm add @valencets/reactive
```

## Core Primitives

### signal(value, options?)

Reactive state container. Reading `.value` inside a `computed` or `effect` auto-tracks the dependency. Writing `.value` notifies all subscribers.

```typescript
import { signal } from '@valencets/reactive'

const count = signal(0)
count.value          // read (tracks dependency)
count.value = 1      // write (notifies subscribers)
count.peek()         // read without tracking
```

Custom equality — skip notifications when values are structurally equal:

```typescript
const pos = signal({ x: 0, y: 0 }, {
  equals: (a, b) => a.x === b.x && a.y === b.y
})
```

### computed(fn, options?)

Lazy derived state. Re-evaluates only when dependencies change. Caches between reads. Diamond-dependency safe — evaluates at most once per flush.

```typescript
import { signal, computed } from '@valencets/reactive'

const firstName = signal('Jane')
const lastName = signal('Smith')
const fullName = computed(() => `${firstName.value} ${lastName.value}`)

fullName.value   // 'Jane Smith'
firstName.value = 'John'
fullName.value   // 'John Smith' (recomputed lazily)
```

### effect(fn)

Side effect that runs immediately and re-runs when dependencies change. Returns a dispose function. Supports cleanup via return value.

```typescript
import { signal, effect } from '@valencets/reactive'

const query = signal('')

const dispose = effect(() => {
  console.log('Searching:', query.value)
  const controller = new AbortController()
  fetch(`/api/search?q=${query.value}`, { signal: controller.signal })
  return () => controller.abort() // cleanup before next run
})

query.value = 'valence' // logs 'Searching: valence', aborts previous fetch
dispose()               // stops the effect, runs final cleanup
```

### batch(fn)

Defers all notifications until the batch completes. Prevents intermediate state from triggering effects. Supports nesting — flushes only on outermost exit. Returns the callback's return value.

```typescript
import { signal, effect, batch } from '@valencets/reactive'

const a = signal(0)
const b = signal(0)
effect(() => console.log(a.value + b.value))

batch(() => {
  a.value = 1
  b.value = 2
  // effect has NOT run yet
})
// effect runs ONCE with 3
```

### untracked(fn)

Read signals without creating dependencies. Useful for accessing reference data inside effects without re-triggering on every change.

```typescript
import { signal, effect, untracked } from '@valencets/reactive'

const tracked = signal(0)
const config = signal({ threshold: 10 })

effect(() => {
  const t = untracked(() => config.value.threshold)
  console.log(tracked.value > t ? 'over' : 'under')
})
// Changing config.value does NOT re-run the effect
```

## DOM Hydration

### bind(element, bindings)

Attach signals to server-rendered DOM elements. Two-way bindings for form inputs, one-way for display. Returns a dispose function.

```typescript
import { signal, computed, bind } from '@valencets/reactive'

const name = signal('')
const greeting = computed(() => name.value ? `Hello, ${name.value}!` : '')

const input = document.querySelector('input[name="name"]')
const display = document.querySelector('.greeting')

const dispose = bind(input, { value: name })
bind(display, { text: greeting })
// User types in input -> name signal updates -> greeting recomputes -> display updates
```

Available bindings:

| Binding | Type | Direction | Description |
|---------|------|-----------|-------------|
| `text` | `ReadonlySignal<string>` | signal -> DOM | Sets `textContent` |
| `value` | `Signal<string>` | two-way | Syncs input `.value` via `input` event |
| `checked` | `Signal<boolean>` | two-way | Syncs checkbox `.checked` via `change` event |
| `visible` | `ReadonlySignal<boolean>` | signal -> DOM | Toggles `display: none` |
| `class` | `Record<string, ReadonlySignal<boolean>>` | signal -> DOM | Toggles CSS classes |
| `attr` | `Record<string, ReadonlySignal<string/null>>` | signal -> DOM | Sets/removes attributes |
| `disabled` | `ReadonlySignal<boolean>` | signal -> DOM | Syncs `.disabled` property |

Security: `on*` event handler attributes are blocked to prevent XSS.

## CMS Field Sinks

### fieldSink(initialValue)

Creates a bundle of signals for a CMS form field — value, visibility, and error state.

```typescript
import { fieldSink } from '@valencets/reactive'

const title = fieldSink('')
title.value.value = 'My Post'
title.error.value = 'Title is required'
title.visible.value = false
```

### condition(deps, predicate)

Bridge between signal deps and a computed boolean — designed for CMS conditional field visibility.

```typescript
import { signal, condition } from '@valencets/reactive'

const role = signal('editor')
const published = signal(false)

const canDelete = condition([role, published], (r, p) => r === 'admin' || !p)
canDelete.value // true (editor + unpublished)
```

## Performance

Benchmarked with tinybench (Node.js, single-threaded):

| Operation | ops/sec |
|-----------|---------|
| signal write+read | 11.7M |
| computed read (cached) | 31.1M |
| signal -> computed -> effect | 2.8M |
| batch 10 writes | 649k |
| 100 computeds fan-out | 54.8k |

The notification system uses a global flush queue instead of recursive snapshots, eliminating per-subscriber array allocations.

## Architecture

**Auto-tracking:** When `computed()` or `effect()` callbacks execute, any `.value` reads automatically register as dependencies. No manual dependency arrays.

**Pull/push hybrid:** Signal writes push dirty flags up the dependency graph. Computed values pull (re-evaluate lazily) only when read. This avoids unnecessary computation for unread derivations.

**Queue-based notification:** All subscriber notifications go through a single global queue. One snapshot allocation per flush cycle, not per subscriber set. Recursion is guarded at 100 flush cycles.

**Cleanup:** Effects remove themselves from all source subscriber sets on re-run and dispose. Computeds clean up old source subscriptions when dependencies change (no lapsed listener leak).

## Conventions

- Zero runtime dependencies
- ESM with `.js` extensions
- No `throw` / `try-catch` — callbacks must not throw (use Result monads)
- No `enum`, `switch`, `unknown`, `export default`, `as any`
- Complexity < 20 per function
- All exports are named and tree-shakeable
