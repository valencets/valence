# Valence — Agent Guide

Canonical orientation file for coding agents. Per-package detail lives in `packages/*/AGENTS.md`.
Human docs: `docs/` and package READMEs. If this file and the code disagree, the code wins — then fix this file.

## What this is

Valence is a schema-driven web framework for Node.js (>= 22) + PostgreSQL 16. One `valence.config.ts`
(collections, fields, stores, routes) derives the whole stack: DB tables + migrations, a server-rendered
admin panel, REST + GraphQL APIs, Zod validation on both sides of the wire, typed entity clients, live
shared state over SSE, and first-party analytics. Public pages ship server-rendered HTML and zero
third-party JavaScript; interactivity comes from Web Components, `Proxy` signals, `fetch`, `EventSource`,
and `data-*` attributes. No virtual DOM, no hydration framework, no client bundler in the app.

## Repository map

pnpm monorepo (`packages/*`), TypeScript strict, ESM only (`"type": "module"`, imports end in `.js`).

| Package | npm name | Role |
|---|---|---|
| `packages/valence` | `@valencets/valence` | CLI (`init/dev/start/migrate/build/user:create/learn`), dev+prod HTTP server, config loader, codegen, esbuild client bundling, store wiring/session identity |
| `packages/cms` | `@valencets/cms` | Schema engine: `collection()`/`field.*`/`global()`, query builder, migration generator, REST + Local API, admin panel (server-rendered HTML strings), auth (Argon2id + sessions + CSRF), media/Sharp |
| `packages/store` | `@valencets/store` | Schema-driven shared state: scopes (`page/session/user/global`), mutations with optimistic rebase, SSE broadcast, fragment mode, declarative `data-*` binding, postgres persistence |
| `packages/core` | `@valencets/core` | Client router (pushState, prefetch, page cache, view transitions, server islands) + server primitives (route matcher, security headers, CSRF, static files, rate limit, middleware) + client telemetry engine (ring buffer, delegation, sendBeacon) |
| `packages/ui` | `@valencets/ui` | 23 dependency-free Web Components on the `ValElement` base (ARIA, i18n, hydration directives), OKLCH tokens, theme contract, Tailwind preset |
| `packages/reactive` | `@valencets/reactive` | Signals: `signal/computed/effect/batch/untracked` + two-way DOM `bind()`. Zero deps |
| `packages/db` | `@valencets/db` | Postgres pool (porsager/postgres), config validation, error mapping, forward-only migration runner |
| `packages/graphql` | `@valencets/graphql` | GraphQL schema + resolvers derived from CMS collections; `POST /graphql` handler |
| `packages/telemetry` | `@valencets/telemetry` | Server side of analytics: beacon ingestion (silent-accept), daily aggregation, retention, dashboard queries |
| `packages/plugin-seo` | `@valencets/plugin-seo` | Injects an `seo` group + auto-title hook into collections |
| `packages/plugin-nested-docs` | `@valencets/plugin-nested-docs` | Parent/child trees + breadcrumbs |
| `packages/plugin-cloud-storage` | `@valencets/plugin-cloud-storage` | S3-compatible storage adapter for media |

### Dependency graph (workspace edges; `@valencets/resultkit` is an external npm dep used everywhere)

```
reactive ──────────┐                 ui (zero deps)
                   ▼
store (reactive, zod)                core (resultkit only)
                                     ▲
db (postgres, zod)                   │
  ▲                                  │
  └── telemetry (core, db)           │
        ▲                            │
cms (core, db, telemetry, reactive, ui, argon2, sharp, tiptap, zod)
  ▲
  ├── graphql (cms, graphql)
  ├── plugin-* (peer: cms)
  └── valence (everything above + esbuild, tsx)
```

Rules: `ui` and `reactive` import nothing internal. `core` imports only resultkit. `db` never imports
`core`. `telemetry` never imports `cms`. Plugins are config transformers with a peer dep on `cms`.
Wiring happens at the top, in `valence`.

## Non-negotiable conventions (enforced by lint, hooks, and `scripts/check-banned-patterns.sh`)

1. **No exceptions.** No `throw`, no `try/catch` in production code. Everything fallible returns
   `Result<T, E>` / `ResultAsync<T, E>` from `@valencets/resultkit`. Wrap throwing APIs at the boundary
   with `fromThrowable` / `ResultAsync.fromPromise`. Handle both branches (`.match`, `.isErr()`).
2. **Error shape.** Per-domain const union + interface: `const FooErrorCode = Object.freeze({...} as const)`
   + `interface FooError { readonly code: FooErrorCode; readonly message: string }`. No `enum`.
3. **Complexity < 20** per function. No `switch` — use frozen dictionary maps and early returns.
4. **No allocation after init** in hot paths (telemetry ring buffer / object pool): pre-allocate, mutate in place.
5. **Zod:** `.safeParse()` only, never `.parse()`.
6. **Named exports only**, barrel `index.ts` per module dir, explicit return types on public functions,
   `kebab-case.ts` filenames. Comments explain WHY, not WHAT.
7. **Banned:** `as any`, `as never`, `as unknown as`, `Record<string, any>`, `import React`,
   `localStorage`/`sessionStorage` for critical state, `process.env` outside config loaders,
   `export default` (except third-party interop).
8. **14kB critical shell**: first paint must fit the initial TCP congestion window. Inline critical CSS,
   defer all non-critical JS. `pnpm check:size` enforces budgets (`budget.json`).

## Security invariants (do not weaken)

- Passwords: Argon2id (`cms/src/auth/password.ts`). Sessions: UUID in `cms_sessions`, expiry +
  soft-delete checked on every validation; cookie `httpOnly; SameSite=Lax; Secure` (Secure derived from transport).
- CSRF: double-submit token, timing-safe compare (`core/src/server/csrf.ts`), on all admin forms.
- Anonymous store sessions: HMAC-SHA256 signed `id.sig` tokens over `CMS_SECRET`, verified timing-safely
  (`valence/src/store-session.ts`). Forged ids → 401. User-scoped stores require a validated CMS session (else 403).
- SQL: parameterized everywhere via `safeQuery` (`cms/src/db/safe-query.ts`); identifiers pass
  `isValidIdentifier` allow-listing (`cms/src/db/sql-sanitize.ts`). Never call `pool.sql` directly in cms.
- HTML: every interpolated string goes through `escapeHtml`. Store hydration JSON is OWASP-escaped;
  SSE fragments are sanitized client-side (scripts, `on*` attrs, `javascript:` URLs stripped).
- Static files: null-byte/backslash/control-char rejection, decode, `..` rejection, then resolved-path
  containment check (`core/src/server/static-files.ts`). Keep the resolve+startsWith barrier visible to CodeQL.
- Security headers + CSP set on every response (`core/src/server/security-headers.ts`); admin uses nonce CSP.
- Telemetry ingestion returns 200 even for bad payloads (avoids client retry storms); bad data is audited, not stored.

## Commands

```bash
pnpm install && pnpm build     # build all (tsc, topological) — REQUIRED before first test run
pnpm test                      # all unit tests (Vitest + happy-dom, no DB needed)
pnpm --filter=@valencets/cms test   # one package
pnpm lint / pnpm check:patterns     # neostandard + banned-pattern grep
pnpm validate                  # typecheck (build) + lint
pnpm db:up                     # Postgres 16 in Docker on localhost:55432 (user/pass: postgres)
npx vitest run tests/integration/   # integration tests (real Postgres)
pnpm test:e2e                  # Playwright (full app)
pnpm ci:local                  # full pre-PR gate, mirrors GitHub CI
```

Gotchas: build before testing (tests import `dist/` of sibling packages in some paths); Node >= 22;
pnpm version is pinned via `packageManager`; Web Component tests must dynamic-import the component in
`beforeAll` so `customElements.define` runs inside happy-dom.

## TDD + commit protocol (machine-enforced)

Commits: `type(scope): description`. Code commits carry TDD suffixes and the sequence is checked by
husky hooks and CI (`scripts/check-tdd-commit-sequence.sh`):

```
test(scope): …  -- RED       # failing test first
feat|fix(scope): …  -- GREEN # minimal implementation; must follow same-scope RED
refactor(scope): … -- REFACTOR # must follow same-scope GREEN
```

Branches: feature branches off `development`; `master` is stable. See `CONTRIBUTING.md`.

## Where to look

| Task | Start at |
|---|---|
| Config shape / route loaders/actions | `packages/valence/src/define-config.ts` |
| Dev/prod server request pipeline | `packages/valence/src/cli.ts` (`runDev`, `runStart`) |
| Add a field type | `packages/cms/AGENTS.md` (7-step checklist) |
| Store mutation lifecycle | `docs/STORES.md`, `packages/store/AGENTS.md` |
| Admin views | `packages/cms/src/admin/` (plain HTML strings, `renderLayout`) |
| Codegen (entities, clients, store modules) | `packages/valence/src/codegen/regenerate.ts` (`// @generated` marker guards user edits) |
| Testing layers, flaky policy | `TESTING.md`, `FLAKY-TESTS.md` |
| Public API surface reviews | `packages/*/**.api.md` (API Extractor reports; update via `pnpm api:update`) |

Do not hand-edit: `node_modules/`, any `dist/`, `packages/*/*.api.md` (generated), `.husky/_`.
