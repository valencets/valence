# @valencets/valence — Agent Guide

The CLI and the application server. This is the top of the dependency graph — it wires cms, store,
telemetry, graphql, core, db together for a user project. Repo-wide rules: root `AGENTS.md`.

## Module map

```
src/
├── cli.ts               # command dispatch: init/dev/start/migrate/build/user:create/learn/telemetry:aggregate
│                        # runDev (~line 508) and runStart (~line 872) contain the HTTP request pipeline
├── define-config.ts     # ValenceConfig/ResolvedValenceConfig + Zod validation; functions (routes, onServer,
│                        # store mutations) are extracted before validation and re-attached after
├── config-loader.ts     # loads valence.config.ts via tsx loader; loadEnvConfig for .env
├── config-template.ts   # generated valence.config.ts + CMS_SECRET minting for init
├── init-steps.ts        # wizard flags (--yes, --no-install/--no-db/--no-migrate/--no-seed/--no-git), prompt queue
├── dev-database.ts      # ensureDevDatabase (shell-free createdb)
├── route-generator.ts   # collection routes (list/detail) from config
├── route-matcher.ts     # :param matching for custom/user routes
├── loader.ts / action.ts# GET loaders / POST-PUT-DELETE actions: execute, serialize, inject into page HTML
├── page-router.ts       # src/pages/ file routing
├── landing-page.ts      # default splash page
├── client-bundler.ts    # esbuild bundling of src/app/client.ts → /_valence/client.js (watch in dev,
│                        # minified at start; compile errors answer 503, last good bundle keeps serving)
├── store-wiring.ts      # registers /store/:slug/* routes, hydration injection, store_states DDL,
│                        # identity resolution (see below), SSE broadcaster wiring
├── store-session.ts     # HMAC-signed anonymous session tokens (mint/verify, timing-safe)
├── codegen/             # regenerate.ts orchestrates: entity interfaces (type-generator), API clients
│                        # (api-client-generator, base-client-generator), store modules via @valencets/store,
│                        # route types. Files starting with `// @generated` are overwritten; others skipped.
├── scaffold/            # FSD scaffold: app/, pages/ (home/list/detail), shared styles
├── learn/               # interactive tutorial served at /_learn during dev
└── outlet-header.ts / page-tokens.ts / validate-collections.ts
```

## Request pipeline order (runDev/runStart — keep them in sync)

security headers → /health → body-limit (Content-Length pre-check) → learn routes (dev) →
custom `registerRoute` routes → user config routes (loaders/actions) → generated collection routes →
admin routes → REST routes → store routes → static `public/` (containment re-checked inline) →
`src/pages/` (store hydration injected) → splash/404.

## Store identity ladder (store-wiring.ts `resolveIdentity`)

1. `cms_session` cookie validated against DB → authenticated `{ id, userId }` (required for `user` scope).
2. `session_id` cookie / `X-Session-Id` header → must be a valid HMAC-signed token; forged → 401.
3. Nothing → mint signed anonymous session, set cookie (Secure iff TLS).
Without a configured secret (bare dev harness) it falls back to a legacy presence check — production
always has `CMS_SECRET`.

## Hard rules

- `init` must work non-interactively (`--yes`, heredocs, CI). User answers reach child processes as
  argv via `execFileSync` — never interpolated into a shell string.
- Codegen never overwrites files missing the `// @generated` first line.
- Store hydration only touches pages that reference a store (`data-store`); other pages stay byte-identical
  and must not mint session cookies.
- Config reload/watch callbacks run inside `ResultAsync.fromPromise` boundaries — a malformed user config
  must never crash the dev server.
