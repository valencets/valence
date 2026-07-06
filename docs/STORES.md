# Stores

Schema-driven shared state for Valence. A store bridges the boundary between
client state and server truth: signals for local reactivity, mutations that
carry intent to an authoritative server, and reconciliation that keeps both
sides honest. Design rationale lives in
[discussion #306](https://github.com/valencets/valence/discussions/306).

The browser already provides the primitives — `Proxy` reactivity via
`@valencets/reactive`, `EventSource` for server push, `fetch` for mutations,
`data-*` attributes for configuration. The store layer adds only what the
browser has no opinion about: schema validation, the optimistic pending
queue, server reconciliation, and fragment swapping.

## Defining a store

Stores are declared in `valence.config.ts` alongside collections:

```ts
import { defineConfig, store, field } from '@valencets/valence'

export default defineConfig({
  // ...
  stores: [
    {
      slug: 'cart',
      scope: 'session',
      fields: [
        field.array({
          name: 'items',
          fields: [
            field.text({ name: 'sku' }),
            field.number({ name: 'qty' }),
            field.number({ name: 'price' })
          ]
        })
      ],
      mutations: {
        addItem: {
          input: [
            field.text({ name: 'sku', required: true }),
            field.number({ name: 'qty', required: true })
          ],
          server: async ({ state, input, pool }) => {
            const rows = await pool.query(`SELECT price FROM products WHERE sku = '${String(input.sku)}'`)
            if (rows.length === 0) return
            const items = (state.items ?? []) as Array<{ sku: string; qty: number; price: number }>
            items.push({ sku: String(input.sku), qty: Number(input.qty), price: (rows[0] as { price: number }).price })
            state.items = items
          },
          client: ({ state, input }) => {
            const items = (state.items ?? []) as Array<{ sku: string; qty: number; price: number }>
            state.items = [...items, { sku: String(input.sku), qty: Number(input.qty), price: 0 }]
          }
        }
      },
      derived: {
        itemCount: (state) => ((state.items ?? []) as unknown[]).length
      },
      fragment: (state) => `<span class="badge">${((state.items ?? []) as unknown[]).length}</span>`
    }
  ]
})
```

From one definition the framework derives Zod validators (enforced on both
client and server via `safeParse`), typed signals, per-mutation POST
endpoints, an SSE channel, hydration, and optional fragment rendering.

Fields are optional in mutation input by default; set `required: true` to
reject missing values. Zod strips unknown keys — only declared input fields
ever reach a `server` function, and mutations with an empty `input` ignore
client args entirely.

## Scopes

The scope selects the storage backend and the SSE audience. The client API
is identical across scopes.

| Scope | Server state | SSE audience |
|---|---|---|
| `page` | None — no routes, no SSE. Typed shared signals with validation only. | — |
| `session` | In-memory, keyed by session, LRU-capped (1000 sessions). | The mutating session's own tabs only. |
| `user` | Same as `session` today. Postgres persistence is planned; mutations already receive the real database pool. | The mutating session's own tabs only. |
| `global` | One shared copy for every session. Mutations from all sessions linearize on one lock. | Every connected client. |

Session-scoped state never crosses sessions — neither via `getState` nor
via SSE.

## The mutation lifecycle

```
component calls cart.addItem({ sku, qty })
  → Zod validates (client) — invalid input returns err() and stops
  → mutation enters the store's pending queue (client-local id)
  → optimistic apply IF the mutation defines a `client` fn (none by default)
  → POST /store/cart/addItem { args, mutationId }
  → Zod validates (server), per-state lock serializes, `server` fn runs
  → response { ok, state, confirmedId, fragment? }
  → reconcile: drop own pending entry, apply server state,
    replay ALL remaining pending mutations (any name) on top
  → on failure: reject entry, roll back to last known server state
    (field defaults + hydration before any confirmation), replay pending
```

Every mutation call returns `Result<void, StoreError>`. The rebase context
(replay map and rollback baseline) is shared across all of a store's
mutations, so concurrent mutations of different names reconcile correctly.

Optimistic tiers match the design discussion: write only `server` and the
UI waits for the response; add a `client` fn when you want zero-latency
feedback. There is no auto-derived optimism.

## Fragment mode and signal mode

Both modes work from the same store, on the same page.

**Signal mode** — components read `client.signals.x.value` (and
`client.derived.*`) and re-render themselves through `@valencets/reactive`.

**Fragment mode** — the server re-renders the store's `fragment(state)`
HTML. The mutating client receives the fragment in its POST response; other
clients in the SSE audience receive it as an `event: fragment`. The swap
targets `[data-store="<slug>"]` elements, sanitizes the HTML (scripts,
`on*` attributes, `javascript:` URLs stripped), and uses `replaceChildren`
so event delegation survives.

Declarative triggers need no JavaScript wiring:

```html
<button data-store="cart" data-mutation="addItem" data-args='{"sku":"abc","qty":1}'>
  Add to cart
</button>
```

The delegate applies `is-pending` on click and resolves it with the server
response; failures mark the trigger `is-error` until the next attempt.
Malformed `data-args` JSON is ignored rather than thrown.

## Client bootstrap

```ts
import { initStores } from '@valencets/store/client'
import { cartDefinition } from './stores/cart.shared.js'

const handle = initStores([cartDefinition])
// handle.stores.cart.signals / .mutations / .derived / .applyServerState
// handle.dispose() tears everything down
```

`initStores` validates definitions, seeds signals from inline
`<script type="application/json" data-store-hydrate="slug">` tags, opens one
`EventSource` per server-backed store that has a `[data-store]` element on
the page, routes `state` events into signal reconciliation and `fragment`
events into DOM swaps, and delegates `[data-mutation]` clicks.

Keep store definitions importable by both `valence.config.ts` and client
entry code. Only client-safe parts (fields, input schemas, `client` fns,
`derived`, `fragment`) are read in the browser; `server` fns execute only
server-side. Generated typed modules (`createXStore` factories plus state
and input interfaces) come from the store codegen.

## Server endpoints

Per store (except `page` scope):

- `POST /store/:slug/:mutation` — body `{ args, mutationId }`; 400 on
  validation failure, 404 on unknown mutation, 413 over 256 KB.
- `GET /store/:slug/state` — current state as JSON.
- `GET /store/:slug/events` — SSE channel (heartbeat every 30 s; one
  session may hold many tabs).
- `GET /store/:slug/hydration` — the hydration script tag for server
  templates that compose pages from fetched partials.

All routes require a session (`session_id`/`cms_session` cookie or
`X-Session-Id` header) and return 401 without one.

## Security model and current limits

- Hydration JSON is OWASP-escaped; fragments are sanitized client-side; SSE
  event names are validated. Both directions carry XSS tests.
- Session identity is currently presence-checked, not verified against a
  session table. Do not treat session/user scope as an authorization
  boundary yet — verification against CMS sessions is planned work.
- `user` scope does not persist to postgres yet (state is in-memory and
  LRU-capped); the mutation `pool` is the real database pool, so mutations
  can already read/write collections.
- Hydration tags are not auto-injected into rendered pages; embed
  `renderStoreHydration(slug, state)` in server templates or rely on the
  bootstrap's SSE/state endpoints.
