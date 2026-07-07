# @valencets/store — Agent Guide

Schema-driven shared state. One definition derives Zod validation (both sides), typed signals,
per-mutation POST endpoints, an SSE channel, optimistic updates with server reconciliation, and
declarative DOM binding. Full contract: `docs/STORES.md`. Repo-wide rules: root `AGENTS.md`.

## Concepts

- **Scope = audience + backend.** `page` (client-only signals), `session` (in-memory LRU, own tabs),
  `user` (postgres `store_states`, keyed by verified userId, all devices), `global` (one copy, everyone).
  `persist: true` moves `session`/`global` state into postgres; invalid on `page`.
- **Mutations carry intent.** Client POSTs `{ args, mutationId }`; server validates (Zod strips unknown
  keys), takes a per-bucket lock (slug + state key), runs the `server` fn, persists, answers
  `{ state, confirmedId, fragment? }`. Client drops the confirmed pending entry, applies server state,
  replays remaining pending `client` fns on top (rebase). No `client` fn = no optimism, UI waits.
- **Two render modes, same store:** signal mode (components read `client.signals/derived`) and fragment
  mode (server-rendered `fragment(state)` HTML swapped into `[data-fragment]` targets, sanitized first).

## Module map

```
src/
├── index.ts            # store() validator (slug/persist/fields/mutations), field re-exports, toStoreValue
├── types.ts            # StoreDefinition/StoreInput, scopes, StoreError codes, JsonCompatible proof type
├── fields/             # store field factories (text, number, boolean, select, array, group, …) + defaults
├── validation/         # zod-generator.ts: fields → Zod schema (strips unknown keys)
├── escape.ts           # OWASP escaping for hydration JSON
├── fragment-selector.ts# resolves [data-fragment] / [data-fragment="slug"] targets
├── server/
│   ├── store-routes.ts     # registerStoreRoutes: stateKeyFor (global → __global__, user → user:<id>,
│   │                       # else session id); SSE audience per scope
│   ├── mutation-handler.ts # Zod validate → per-bucket promise-chain lock → server fn in fromPromise → persist
│   ├── state-backend.ts / session-state.ts (in-memory LRU, 1000 buckets) / pg-state-holder.ts (store_states)
│   ├── sse-broadcaster.ts  # broadcast / sendToSession / sendToUser, 30s heartbeat
│   ├── fragment-renderer.ts / hydration.ts  # renderStoreFragment, renderStoreHydration (escaped JSON tag)
├── client/
│   ├── bootstrap.ts        # initStores: validate defs → hydrate signals → SSE per bound server store →
│   │                       # delegate [data-mutation] clicks → bind [data-field]/[data-commit]
│   ├── store-client.ts / store-signals.ts   # signals + derived from @valencets/reactive
│   ├── pending-queue.ts / reconciler.ts     # optimistic queue; rebase on every server answer (batched)
│   ├── mutation-caller.ts / post-mutation.ts / mutation-delegate.ts  # fetch transport, is-pending/is-error classes
│   ├── field-binding.ts    # data-field two-way binding, schema-coerced, commits via nearest data-commit
│   ├── fragment-reconciler.ts # sanitizes HTML (scripts/on*/javascript: stripped), replaceChildren
│   ├── sse-listener.ts     # EventSource wrapper, validated event names
│   └── hydration.ts        # reads <script data-store-hydrate> tags
└── codegen/store-generator.ts  # typed createXStore modules for src/shared/stores/
```

## Hard rules

- State is JSON-only (`StoreValue`); it crosses the wire and is cloned via JSON round-trips.
  `toStoreValue()` widens typed app data without casts — don't add `as` casts instead.
- Session state must never cross sessions (not via getState, not via SSE). Scope decides audience —
  changing `stateKeyFor` or the broadcaster routing is a security change.
- The mutation lock is in-process; multi-node deployments need row-level locking on `store_states`
  before sharing user-scoped stores across instances (documented limit).
- Fragments swap only into dedicated `[data-fragment]` targets, never the `data-store` container itself.
- Server endpoints: 400 validation, 401 forged session, 403 anonymous on user scope, 404 unknown
  mutation, 413 over 256 KB. Keep those exact.
