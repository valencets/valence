# @valencets/core — Agent Guide

Client router + server primitives + client telemetry engine. Depends only on `@valencets/resultkit`.
Repo-wide rules: root `AGENTS.md`.

## Module map

```
src/
├── router/                  # Browser-side, HTML-over-the-wire
│   ├── router-types.ts      # RouterErrorCode/RouterError, RouterConfig, resolveConfig
│   ├── push-state.ts        # initRouter: <a> click interception → fetch → fragment swap → pushState
│   ├── prefetch.ts          # hover-intent prefetch (cursor velocity + dwell timer), TTL cache
│   ├── page-cache.ts        # LRU + TTL, sessionStorage-backed, stale-while-revalidate
│   ├── fragment-swap.ts     # DOMParser (inert, scripts neutralized), extractFragment, swapContent, moveBefore persistence
│   ├── view-transitions.ts  # wraps swap in document.startViewTransition; [transition:name] pairing
│   ├── transition-presets.ts# named CSS transition presets
│   ├── server-islands.ts    # [server:defer][src] deferred fragments, X-Valence-Fragment: 1
│   ├── outlet-swap.ts / val-outlet.ts  # named outlet regions for partial swaps
│   ├── scroll-restore.ts    # scroll position per history entry
│   ├── form-enhance.ts      # progressive form enhancement over fetch
│   ├── fetch-retry.ts       # bounded retry wrapper returning ResultAsync
│   ├── dev-overlay.ts       # dev-mode error overlay
│   └── route-helpers.ts
├── server/                  # node:http primitives (no framework)
│   ├── server-router.ts     # createServerRouter<TCtx>: Map dispatch, 404/405, safeDispatch error boundary
│   ├── route-matcher.ts     # :param path matching
│   ├── http-helpers.ts      # sendHtml/sendJson/sendError, readBody (1 MiB cap), isFragmentRequest
│   ├── security-headers.ts  # CSP (+nonce), HSTS, XFO, COOP/CORP … setSecurityHeaders on every response
│   ├── csrf.ts / csrf-middleware.ts  # 64-hex token, timing-safe validation
│   ├── static-files.ts      # resolveStaticPath (traversal defense), MIME map, range support
│   ├── rate-limit.ts, cors.ts, origin-check.ts, safe-redirect.ts, auth-guard.ts
│   ├── body-limit.ts, timeout-config.ts, trailing-slash.ts, cache-control.ts
│   ├── middleware-pipeline.ts / middleware-types.ts / request-context.ts
│   └── html-template.ts     # page shell helper
└── telemetry/               # Client-side capture (server half is @valencets/telemetry)
    ├── intent-types.ts      # IntentType/BusinessType const unions, GlobalTelemetryIntent (monomorphic shape)
    ├── object-pool.ts       # pre-allocated slots, power-of-two capacity, Result-validated access
    ├── ring-buffer.ts       # bitmask pointer math, overwrite-oldest on saturation, collectDirty/markFlushed
    ├── event-delegation.ts  # ONE listener on root; data-telemetry-* attrs; auto tel:/mailto: lead detection
    ├── flush.ts             # navigator.sendBeacon, URL validation, scheduleAutoFlush (+ visibilitychange)
    └── consent.ts           # shouldTrack gate
```

## Hard rules

- Telemetry hot path allocates nothing: no `new` after pool creation; mutate slots in place, flip `isDirty`.
- Fetched HTML is parsed with `DOMParser.parseFromString` (inert document); swaps use `replaceChildren`,
  persistent elements (`data-valence-persist` / `transition:persist` + stable `id`) move via `Element.moveBefore`.
- Fragment protocol: request/response header `X-Valence-Fragment: 1`; version mismatch clears prefetch cache.
- Router lifecycle events: `valence:before-navigate` (cancelable), `valence:before-swap`, `valence:after-swap`,
  `valence:navigated`, `valence:island-loaded|island-error`.
- `safeDispatch` in server-router is the server-side exception boundary (mirror of `safeJsonParse`): a handler
  that throws is logged and answered with 500 — never re-thrown.
- Never weaken `static-files.ts` checks; the resolve+startsWith containment must stay explicit (CodeQL taint tracking).

## Tests

Vitest + happy-dom; no network, no DB. Cover both Result branches, buffer saturation/wrap-around,
cache TTL/eviction, swap with/without persistent elements, 404/405 fallthrough.
