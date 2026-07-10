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
import { defineConfig } from '@valencets/valence'
import { field } from '@valencets/store'
import type { StoreInput } from '@valencets/store'

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
            const rows = await pool.query('SELECT price FROM products WHERE sku = $1', [String(input.sku)])
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

### The pool contract

Mutation `server` fns receive a database handle with one method:
`pool.query(text, params?)`. Values ALWAYS travel in the `params` array —
they bind as `$n` placeholders in the driver, so user input never touches
the SQL text. Never interpolate values into `text`:

```ts
// ✓ parameterized — input binds server-side
const rows = await pool.query('SELECT price FROM products WHERE sku = $1', [String(input.sku)])

// ✗ never do this — SQL injection
const rows = await pool.query(`SELECT price FROM products WHERE sku = '${String(input.sku)}'`)
```

Params are scalars (`string | number | boolean | null`); convert wider
values (dates, arrays) to strings or JSON before binding.

Fields are optional in mutation input by default; set `required: true` to
reject missing values. Every field type takes a `default` — including
`array` and `group` — and `toStoreValue()` widens typed app data
(interfaces included) into store state without casts. Zod strips unknown keys — only declared input fields
ever reach a `server` function, and mutations with an empty `input` ignore
client args entirely.

## Scopes

The scope selects the storage backend and the SSE audience. The client API
is identical across scopes.

| Scope | Server state | SSE audience |
|---|---|---|
| `page` | None — no routes, no SSE. Typed shared signals with validation only. | — |
| `session` | In-memory, keyed by session, LRU-capped (1000 sessions). | The mutating session's own tabs only. |
| `user` | Postgres-backed (`store_states` table, one row per store + user), keyed by the verified `userId` — state follows the user across sessions, devices, and restarts. Requires an authenticated cms session (403 otherwise). | Every connection of that user, across all their sessions. |
| `global` | One shared copy for every session. Mutations from all sessions linearize on one lock. | Every connected client. |

Session-scoped state never crosses sessions — neither via `getState` nor
via SSE.

### Durable state with `persist`

Persistence is orthogonal to audience. `user` scope always persists;
`session` and `global` stores opt in with `persist: true`:

```ts
{ slug: 'server-config', scope: 'session', persist: true, fields: [...] }
```

A persisted session store writes each bucket to `store_states` keyed by
the signed session id, so anonymous state survives server restarts and
LRU pressure — the durable-anonymous-draft case (config generators,
carts) that in-memory session state cannot cover. A persisted global
store keys one row as `__global__` and survives restarts too.
`persist: true` on `page` scope is a definition error: page stores have
no server state to persist.

Anonymous persisted rows opt in to automatic expiry with `retentionDays`:

```ts
{ slug: 'drafts', scope: 'session', persist: true, retentionDays: 30, fields: [...] }
```

The sweeper hard-deletes rows whose `updated_at` is older than the window
— once at boot, then every 6 hours. `user:*` keys and `__global__` are
never pruned; `retentionDays` is only valid on persisted `session` stores
(user and global state must never expire, and in-memory stores already
expire via LRU). Without `retentionDays`, anonymous rows grow unbounded —
prune `store_states` by `updated_at` yourself.

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
clients in the SSE audience receive it as an `event: fragment`. Swaps land
only in dedicated targets — a bare `data-fragment` inside the store's
container, or `data-fragment="<slug>"` anywhere — never in the `data-store`
container itself, so forms and triggers sitting next to the preview
survive every update. The HTML is sanitized (scripts, `on*` attributes,
`javascript:` URLs stripped) and applied with `replaceChildren` so event
delegation survives. On first paint the runtime renders the fragment
client-side from hydrated state, so the pane is never empty before the
first mutation.

## Declarative binding

Declare the store once on a container; everything inside inherits it:

```html
<section data-store="cart">
  <fieldset data-commit="updateQuantity">
    <input data-field="qty" type="number">
  </fieldset>

  <button data-mutation="addItem" data-args='{"sku":"abc","qty":1}'>
    Add to cart
  </button>

  <div data-fragment></div>
</section>
```

- `data-field="name"` binds a control to the store field both ways: state
  repaints unfocused controls, edits commit through the nearest
  `data-commit` mutation as `{ name: value }` — coerced by the field's
  schema type (numbers become numbers, booleans read `checked`). Keystroke
  input debounces; `change` commits immediately. A field with no
  `data-commit` ancestor is read-only. Works with native controls and
  ValElements alike.
- `data-mutation` triggers resolve their store from the trigger itself or
  the nearest `data-store` ancestor. The delegate applies `is-pending` on
  click and resolves it with the server response; failures mark the
  trigger `is-error` until the next attempt. Malformed `data-args` JSON is
  ignored rather than thrown.
- Anything richer — indexed array edits, multi-field payloads — uses the
  programmatic API: `client.mutations.name(args)`.

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
server-side. Typed modules (`createXStore` factories plus state and input
interfaces) are regenerated into `src/shared/stores/<slug>.ts` whenever
`valence.config.ts` changes — user-edited files (missing the
`// @generated` marker) are never overwritten.

## Client delivery

The framework ships the runtime — no bundler configuration in the app.
Put the client bootstrap at the conventional entry `src/app/client.ts`
(or `.js`):

```ts
// src/app/client.ts
import { initStores } from '@valencets/store/client'
import { serverConfigDefinition } from '../shared/stores/definitions.js'

initStores([serverConfigDefinition])
```

`valence dev` bundles it with esbuild (rebuilt on change, inline source
maps), `valence start` bundles once at boot (minified), and both serve
the result at `/_valence/client.js` with ETag revalidation. Every
server-rendered page that references a store via `data-store` gets
`<script type="module" src="/_valence/client.js"></script>` injected
automatically alongside its hydration tags; pages without store
references stay byte-identical. A compile error never takes the server
down — the route answers 503 (dev logs the error and recovers on the
next file change) and the last good bundle keeps serving.

## Server endpoints

Per store (except `page` scope):

- `POST /store/:slug/:mutation` — body `{ args, mutationId }`; 400 on
  validation failure, 403 when a declared `Origin`/`Referer` does not match
  the request host, 404 on unknown mutation, 413 over 256 KB.
- `GET /store/:slug/state` — current state as JSON.
- `GET /store/:slug/events` — SSE channel (heartbeat every 30 s; one
  session may hold many tabs, capped at 8 connections per store — at the
  cap the oldest connection of that session is closed so the newest tab
  wins).
- `GET /store/:slug/hydration` — the hydration script tag for server
  templates that compose pages from fetched partials.

Custom routes read a caller's bucket through the hydrator the wiring
returns: `await hydrator.readState(slug, req, res)` resolves the same
identity ladder the endpoints use and answers `null` for unknown stores or
unauthorized callers — a download route can serve exactly what the page
shows.

## Session identity

Every route resolves the caller's identity, strongest claim first:

1. A `cms_session` cookie is verified against the CMS sessions table and
   yields an authenticated identity with a `userId` — this is what
   user-scoped stores key on, and it reaches mutation `server` fns as
   `session.userId`.
2. A `session_id` cookie or `X-Session-Id` header must carry a
   **server-signed token** (`id.hmac`, HMAC-SHA256 over `CMS_SECRET`).
   Forged or tampered ids get 401 — presenting someone else's session id no
   longer opens their bucket.
3. No claim at all mints a fresh signed anonymous session and sets the
   cookie, so anonymous carts work from first contact and every later
   request lands in the same bucket.

Stale cms sessions (e.g. after logout) degrade gracefully to a fresh
anonymous identity. User-scoped routes return 403 for anonymous callers.
Without a configured secret (bare `registerStoreRoutesOnServer` in dev
harnesses), identity falls back to the legacy presence check.

## Automatic hydration

Server-rendered pages that reference a store via `data-store="<slug>"` get
their `<script data-store-hydrate>` tags injected automatically before
`</body>` — page routes from `src/pages/`, generated collection routes, and
loader routes are all covered. Pages that reference no store are left
byte-identical and never mint session cookies. First paint of a store page
mints the anonymous session cookie, so the hydrated state and every later
fetch/SSE call share one bucket. User-scoped stores are skipped for
anonymous visitors. Static HTML served from `public/` is not transformed —
embed `renderStoreHydration` manually there or rely on the `/state`
endpoint.

New projects get the `store_states` table from the scaffolded initial
migration; existing projects get it from an idempotent
`CREATE TABLE IF NOT EXISTS` the wiring issues once at boot when a
user-scoped store and a database pool are configured.

## Security model and current limits

- Hydration JSON is OWASP-escaped; fragments are sanitized client-side; SSE
  event names are validated. Both directions carry XSS tests.
- Anonymous session ids are HMAC-signed and verified timing-safely;
  authenticated identity is validated against the CMS sessions table with
  its expiry and soft-delete checks.
- Mutation POSTs carry Origin defense in depth on top of `SameSite=Lax`
  cookies: a declared `Origin` (or `Referer` when no Origin is present)
  whose host differs from the request host — including the opaque `null`
  origin — is rejected with 403 before identity resolution, so rejected
  requests never mint session cookies. Requests declaring neither header
  (curl, server-to-server) pass: they carry no ambient browser credentials
  to launder.
- Persisted buckets (`user` scope, or `persist: true`) run every mutation
  as a row-locked read-modify-write: one transaction takes
  `SELECT … FOR UPDATE` on the bucket's `store_states` row around the
  `server` fn, so multi-node deployments sharing one database serialize on
  the row instead of losing writes — and a failing `server` fn rolls the
  bucket back. The in-process per-bucket lock remains as the fast-path
  serializer within each node.
- **Supported topologies:** in-memory stores (`session`/`global` without
  `persist`) are single-node — each node holds its own state, and the
  in-process lock is the only serializer. Persisted stores are safe across
  any number of nodes sharing one postgres database.
- Custom `StorePool` implementations without a `transaction` primitive
  degrade persisted buckets to single-node semantics (in-process lock
  only). The pool `valence` wires from your database config always
  provides `transaction`.
- Signed anonymous sessions are not stored server-side, so they cannot be
  revoked individually — rotate `CMS_SECRET` to invalidate all of them.
