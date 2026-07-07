# packages/core

Read `packages/core/AGENTS.md` — it is the current module map and rule set for this package.
Repo-wide conventions live in the root `AGENTS.md`.

Package-specific reminders:

- Telemetry hot path: zero allocation after init. Pre-allocated object pool + ring buffer,
  mutate slots in place, flip `isDirty`, never `new` at runtime.
- Router: fetched HTML is parsed inert via `DOMParser`; swap with `replaceChildren`;
  persistent elements move via `Element.moveBefore`. Fragment protocol header: `X-Valence-Fragment: 1`.
- Server: `safeDispatch` is the exception boundary — handlers that throw get logged + 500, never re-thrown.
- Never weaken `static-files.ts` traversal checks; keep the resolve+startsWith containment explicit.
- Tests: Vitest + happy-dom, both Result branches, buffer saturation, cache TTL/eviction, 404/405 paths.
