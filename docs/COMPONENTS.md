# Authoring Web Components

Valence's component model **is** the Web Component. There is no virtual DOM and
no `.valence`/SFC compiler — a template compiler plus a runtime is the exact
layer Valence bets against. Instead, `defineComponent()` is a thin declarative
factory over the framework's `ValElement` base, so a component you author
inherits — for free — declarative hydration, telemetry, i18n, design tokens, and
ARIA, and gains reactive signals with `data-bind` templating.

It lives at the subpath `@valencets/ui/component`. The main `@valencets/ui`
entry (the presentational `val-*` primitives) stays free of any reactive/store
import, so public pages never pull it onto the 14 kB critical path.

## A first component

```ts
// src/components/counter.ts
import { defineComponent, signal } from '@valencets/ui/component'

export const Counter = defineComponent({
  tag: 'x-counter',                                   // must contain a hyphen
  props: { start: { type: 'number', default: 0 } },   // typed + reflected
  styles: `button { font: var(--val-text-sm) var(--val-font-sans) }`,
  template: `
    <button data-bind="onclick:increment">
      <span data-bind="text:label"></span>:
      <span data-bind="text:count"></span>
    </button>`,
  setup ({ props, ctx }) {
    const count = signal(props.start)                 // props.start is `number`
    return {
      count,
      label: 'Count',
      increment: () => { count.value = count.value + 1 }
    }
  }
})
```

Register it (Phase 3 will do this for you from config):

```ts
Counter.define()   // idempotent customElements.define('x-counter', …)
```

```html
<x-counter start="5"></x-counter>
```

## The pieces

### `tag`
The custom-element name. Must contain a hyphen (the platform rule). This is also
the key codegen will use to derive typed intrinsic elements (Phase 3).

### `props`
A declarative, typed attribute schema. Each entry is `{ type, default? }` with
`type` one of `'string' | 'number' | 'boolean'`. Attributes are coerced to that
type and passed to `setup()` as `props`, fully typed from the schema:

| type | attribute → value |
| --- | --- |
| `string` | the raw attribute, or `default` when absent |
| `number` | `Number(attr)`, or `Number(default)` when absent |
| `boolean` | present and not `"false"` → `true`; absent → `default` |

### `template`
A plain HTML string. Interactivity is wired with **`data-bind`** markers — the
same `data-*` mental model stores use — resolved against what `setup()` returns.
No new expression language, no `{{ }}`.

| marker | binds to | example |
| --- | --- | --- |
| `text:key` | element text content | `<span data-bind="text:count">` |
| `value:key` | two-way input value | `<input data-bind="value:name">` |
| `checked:key` | two-way checkbox | `<input type="checkbox" data-bind="checked:agree">` |
| `visible:key` | `display` from a boolean | `<div data-bind="visible:isOpen">` |
| `class:name:key` | toggle a class from a boolean | `data-bind="class:active:isOpen"` |
| `attr:name:key` | set/remove an attribute | `data-bind="attr:aria-expanded:isOpen"` |
| `on<event>:key` | an event handler | `data-bind="onclick:increment"` |

Multiple bindings on one element are comma-separated:
`data-bind="text:count, class:hot:isHot"`.

Signal bindings are reactive through `@valencets/reactive` `bind()`: update a
signal in a handler and the DOM follows. `on*` markers map to
`addEventListener`; all bindings are torn down automatically on disconnect.

### `styles`
Optional scoped CSS injected into the shadow root. Use design tokens
(`var(--val-*)`) — they cross the shadow boundary and respond to theme changes.

### `shadow`
Shadow DOM is on by default. Set `shadow: false` for a light-DOM component (for
example, one that must be styled by page-level CSS).

### `setup({ props, ctx })`
Runs once at hydration. Create signals, derive values, and return a map whose
keys the `data-bind` markers reference — signals for state, functions for
handlers. `ctx` carries the ValElement surface:

- `ctx.host` — the element instance (escape hatch).
- `ctx.emit(action, detail?)` — fire a `val:interaction` telemetry event.
- `ctx.locale` — the current locale from the shared observer.

## Hydration directives

Because the component extends `ValElement`, the declarative hydration directives
work out of the box — the element stays inert HTML until the condition fires:

```html
<x-counter hydrate:visible></x-counter>
<x-panel hydrate:media="(min-width: 1024px)"></x-panel>
```

## Roadmap

- **Store wiring** — `ctx.store('cart')` will return the live, schema-driven
  store client (signals + mutations), so components join the same
  server-is-truth, optimistic, SSE-reconciled state as the rest of the app.
- **Config + codegen** — declare `components: [Counter]` in `valence.config.ts`;
  codegen registers them on the client and emits typed intrinsic elements.

Tracked in the `defineComponent` issue (#373).
