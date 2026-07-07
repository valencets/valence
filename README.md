<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark-animated.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/logo-light-animated.png">
    <img alt="Valence" src="./assets/logo-light-animated.png" width="280">
  </picture>
</p>

<p align="center"><strong>The schema-driven web framework. One TypeScript config. The whole stack derived.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@valencets/valence"><img src="https://img.shields.io/npm/v/@valencets/valence" alt="npm"></a>
  <a href="https://socket.dev/npm/package/@valencets/valence"><img src="https://socket.dev/api/badge/npm/package/@valencets/valence" alt="Socket"></a>
  <a href="https://github.com/valencets/valence/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/valencets/valence/ci.yml?branch=master&label=CI" alt="CI"></a>
  <a href="https://github.com/valencets/valence/blob/master/LICENSE"><img src="https://img.shields.io/github/license/valencets/valence" alt="License"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
  <a href="https://github.com/neostandard/neostandard"><img src="https://img.shields.io/badge/code_style-neostandard-brightgreen?style=flat" alt="neostandard"></a>
</p>

---

> **Status: Pre-1.0.** Valence is in active development. The API surface is stabilizing but breaking changes may occur. Security hardening and package-by-package audits are ongoing.

## The premise

Modern web development stacks frameworks on frameworks: a rendering library, a state manager, a data-fetching cache, a form library, a bundler to hold it together, and a vendor script for analytics — each with its own mental model, each redescribing the same data the last layer already knew about. Every layer is a place for the description of your application to drift out of sync with the application itself.

Valence makes one bet instead: **describe the application once, and derive everything from that description.**

- **The schema is law.** Collections, fields, stores, and routes live in one `valence.config.ts`. Database tables, migrations, a server-rendered admin panel, REST and GraphQL APIs, Zod validation on both sides of the wire, typed entity clients, and live shared state are all *derived* — never hand-synchronized. If it isn't in the schema, it doesn't exist; if it is, everything downstream already knows.
- **The server is true.** State changes are mutations that carry *intent* — "add this item", not "here is my copy of the world." The server validates, linearizes, and answers with authoritative state; clients apply optimistic updates and rebase their pending work on every answer. No stale caches to invalidate, no client-side source-of-truth to reconcile by hand.
- **The browser is enough.** Public pages ship server-rendered HTML and zero third-party JavaScript. Interactivity comes from what the platform already provides — Web Components, signals over `Proxy`, `EventSource` for push, `fetch` for mutations, `data-*` attributes for wiring. There is no virtual DOM, no hydration waterfall, no framework runtime to ship, version, and eventually migrate away from.
- **Discipline is a feature.** Everything that can fail returns `Result<T, E>` — both branches handled, enforced by lint. Functions stay under complexity 20. Features land as failing-test-first commits, checked by CI. The point isn't ceremony; it's that errors stay *legible* in a codebase meant to outlive its authors' attention.

## One schema

```typescript
// valence.config.ts
import { defineConfig, collection, field } from '@valencets/valence'
import { field as storeField } from '@valencets/store'

export default defineConfig({
  db: { /* postgres connection */ },
  server: { port: 3000 },

  collections: [
    collection({
      slug: 'posts',
      versions: { drafts: true },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', slugFrom: 'title', unique: true }),
        field.richtext({ name: 'body' }),
        field.boolean({ name: 'published' })
      ]
    }),
    collection({
      slug: 'users',
      auth: true,
      fields: [field.text({ name: 'name', required: true })]
    })
  ],

  stores: [{
    slug: 'cart',
    scope: 'session',        // who shares this state: page | session | user | global
    persist: true,           // survive restarts in postgres
    fields: [storeField.array({ name: 'items', fields: [/* … */] })],
    mutations: {
      addItem: {
        input: [storeField.text({ name: 'sku', required: true })],
        server: async ({ state, input, pool }) => { /* the one source of truth */ },
        client: ({ state, input }) => { /* optional zero-latency optimism */ }
      }
    },
    fragment: (state) => `<span class="badge">${(state.items as unknown[]).length}</span>`
  }],

  routes: [{
    path: '/blog/:slug',
    collection: 'posts',
    type: 'detail',
    loader: async ({ params, pool }) => {
      const post = await pool`SELECT * FROM posts WHERE slug = ${params.slug}`
      return { data: { post: post[0] } }
    }
  }],

  admin: { pathPrefix: '/admin', requireAuth: true },
  graphql: true,
  telemetry: { enabled: true, endpoint: '/api/telemetry', siteId: 'mysite' }
})
```

That one file yields: `posts` and `users` tables with migrations, a server-rendered admin panel with drafts, revision history, and Argon2id session auth, a REST API at `/api/posts`, a GraphQL endpoint, typed routes with loaders and actions, generated entity interfaces and API clients, a live `cart` shared across the visitor's tabs and server restarts, and first-party analytics running entirely in your Postgres.

## Quick start

```bash
npx @valencets/valence init my-site
cd my-site
pnpm dev
```

The wizard walks through database setup and options; it works identically in a terminal, a heredoc, or CI. Pass `--yes` for defaults, with granular `--no-install`, `--no-db`, `--no-migrate`, `--no-seed`, `--no-git` skips. Open `http://localhost:3000/admin` to sign in.

## State without a framework

The store system is where the bet pays off most visibly. A store declares its **scope** — the social radius of its state — and the framework derives the storage backend, the identity requirements, and exactly who receives live updates:

| Scope | Server state | Who gets live updates |
|---|---|---|
| `page` | none — typed, validated signals only | — |
| `session` | in-memory, or postgres with `persist: true` | the visitor's other tabs |
| `user` | postgres, keyed by verified user id | every device the user is signed in on |
| `global` | one shared copy | every connected client |

Pages bind to stores declaratively — the store is named once on a container and everything inside inherits it:

```html
<section data-store="cart">
  <fieldset data-commit="updateQuantity">
    <input data-field="qty" type="number">   <!-- two-way, schema-coerced -->
  </fieldset>
  <button data-mutation="addItem" data-args='{"sku":"abc"}'>Add to cart</button>
  <div data-fragment></div>                   <!-- server-rendered live preview -->
</section>
```

`data-field` binds controls to store fields both ways with coercion driven by the schema. `data-mutation` buttons fire named mutations with pending/error affordances. `data-fragment` receives server-rendered HTML over SSE — LiveView-style — while signal-mode components on the same page read the same state through `@valencets/reactive`. Anonymous visitors get HMAC-signed sessions from first paint; authenticated users get state that follows them across devices. The client bundle is built and served by the framework — drop a `src/app/client.ts` in your project and `valence dev` handles esbuild, watching, and script injection.

## What you get

**Schema engine** — 22 field types (text through richtext, relations, media, blocks, tabs), conditional fields, per-field access control and hooks, globals, and migrations generated from schema diffs.

**Admin panel** — server-rendered at `/admin`: Tiptap rich text, draft versioning with diff view, autosave, live preview, bulk operations, Sharp image processing. CSRF-protected forms, Argon2id sessions.

**API layer** — REST with Zod validation and collection-level `access` control, auto-generated GraphQL, a Local API sharing the same validation and hooks, and Postgres full-text search.

**Routing** — `src/pages/` file routing, loaders and actions, an `onServer` escape hatch for custom endpoints and WebSockets, view transitions.

**Frontend** — 23 dependency-free, ARIA-compliant Web Components with OKLCH design tokens and light/dark theming (`<html data-theme="dark">`); a signals package with two-way DOM bindings that work on native inputs and ValElements alike; typed entity clients and store modules regenerated on every config change.

**Telemetry** — first-party analytics in your own Postgres. `data-telemetry-*` attributes, a pre-allocated ring buffer on the client, `sendBeacon` flushes, daily aggregation. No third-party scripts, ever.

**Security** — Argon2id, CSRF double-submit, `httpOnly`/`Secure`/`SameSite` sessions, HMAC-signed anonymous store sessions, path-traversal protection, parameterized SQL everywhere, CodeQL and Socket audits in CI.

## Packages

| Package | What it does | External deps |
|---------|-------------|---------------|
| `@valencets/valence` | CLI, dev/prod server, scaffold, codegen, client bundling. | esbuild, tsx, zod, @valencets/resultkit |
| `@valencets/cms` | Schema engine: tables, validators, REST, admin UI, auth, media. | tiptap, argon2, sharp, zod, @valencets/resultkit |
| `@valencets/store` | Schema-driven shared state: scopes, mutations, SSE, optimistic updates, declarative binding. | zod, @valencets/resultkit |
| `@valencets/ui` | 23 Web Components. ARIA, i18n, telemetry hooks, hydration directives, OKLCH tokens. | none |
| `@valencets/reactive` | Signals, computed, effects, DOM bindings. | none |
| `@valencets/core` | Router + server: pushState nav, fragment swaps, prefetch, view transitions. | @valencets/resultkit |
| `@valencets/db` | Postgres layer: tagged-template SQL, Result-based errors, migration runner. | postgres, zod, @valencets/resultkit |
| `@valencets/graphql` | GraphQL schema + resolvers derived from collections. | graphql, @valencets/resultkit |
| `@valencets/telemetry` | Beacon ingestion, aggregation, retention. | postgres, @valencets/resultkit |

All MIT-licensed, all audited via Socket. Public-facing pages ship zero third-party JavaScript.

## The discipline is the product

| Rule | Why |
|------|-----|
| `Result<T, E>` everywhere | If it can fail, the type says so — and lint refuses `throw`, `try/catch`, and unhandled branches. |
| Complexity < 20 | Every function fits on one screen. |
| Test-first commits | RED test, then GREEN implementation — checked by CI, not by convention. |
| 14kB critical shell | First paint in the first TCP round trip. |
| Zero third-party JS on public pages | Your site ships your code. Tiptap is admin-only. |
| 4k+ tests, integration against real Postgres | Mocks drift; the driver doesn't lie. |

These constraints aren't ceremony. They're the reason a one-person team can hold the whole system in their head, and the reason errors surface where they happen instead of three layers away.

## Documentation

- [Getting Started](GETTING-STARTED.md)
- [Architecture](ARCHITECTURE.md)
- [Stores & shared state](docs/STORES.md)
- [CMS Guide](CMS-GUIDE.md)
- [Developer Guide](DEVELOPER-GUIDE.md)
- [Troubleshooting](TROUBLESHOOTING.md)

## Contributing

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for standards and the TDD workflow.

## License

MIT
