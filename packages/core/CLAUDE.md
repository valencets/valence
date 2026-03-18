# packages/core

Telemetry engine, HTML-over-the-wire router, and server-side routing primitives. The three critical subsystems in Valence.

## Module Map

```
src/
├── telemetry/
│   ├── intent-types.ts       # IntentType const union, GlobalTelemetryIntent, TelemetryError
│   ├── object-pool.ts        # TelemetryObjectPool (pre-allocated slots, getSlot/resetSlot)
│   ├── ring-buffer.ts        # TelemetryRingBuffer (circular buffer, modulo pointer math)
│   ├── event-delegation.ts   # Single click listener on root, data-* attribute reading
│   ├── flush.ts              # sendBeacon dispatch, scheduleAutoFlush, visibilitychange
│   └── index.ts
├── router/
│   ├── router-types.ts       # RouterErrorCode, RouterError, RouterConfig, ResolvedRouterConfig, resolveConfig, CachedResponse, NavigationDetail, PageCacheEntry, NavigationPerformance
│   ├── push-state.ts         # history.pushState() navigation, <a> click interception, initRouter, shouldIntercept, RouterHandle
│   ├── prefetch.ts           # Hover-intent prefetch (velocity + trajectory), initPrefetch, calculateVelocity, PrefetchHandle
│   ├── fragment-swap.ts      # DOMParser fragment extraction, parseHtml, extractFragment, extractTitle, swapContent, supportsMoveBefore
│   ├── page-cache.ts         # LRU page cache with TTL, sessionStorage persistence, version invalidation, initPageCache, PageCacheHandle
│   └── index.ts
├── server/
│   ├── server-types.ts       # ServerErrorCode, ServerError, RouteHandler, RouteEntry, ServerRouter
│   ├── server-router.ts      # createServerRouter (path-based dispatch, 404/405 handling, safe error boundary)
│   ├── http-helpers.ts       # sendHtml, sendJson, sendError, isFragmentRequest, readBody
│   └── index.ts
└── index.ts
```

## Telemetry Rules

- All `GlobalTelemetryIntent` objects are pre-allocated at boot. Never use `new` at runtime.
- The `TelemetryRingBuffer` has fixed capacity. Modulo arithmetic for pointer advancement.
- Flush via `navigator.sendBeacon`. Reset `isDirty` flags, never destroy objects.
- Single event listener on `document.body` using event delegation. Read `data-*` attributes.

## Router Rules

- Intercept `<a>` clicks, prevent default, use `history.pushState()`.
- Parse fetched HTML with `DOMParser.parseFromString()` (scripts are neutralized).
- Extract `<main>` fragment via `querySelector`, swap via `replaceChildren()`.
- Prefetch on hover intent (velocity + trajectory calculation).
- Use `Element.moveBefore()` for persistent Web Components to preserve lifecycle state.
- Fragment protocol: `X-Valence-Fragment: 1` header for partial responses.
- Page cache: LRU with TTL, persists to sessionStorage, auto-invalidates on version mismatch.

## Server Rules

- `createServerRouter<TCtx>()` returns a typed `ServerRouter` with `register` and `handle`.
- Route entries declare `GET` and/or `POST` handlers per path.
- Unmatched routes fall through to a registered `/404` handler or a default 404 response.
- `isFragmentRequest()` checks `X-Valence-Fragment: 1` header for fragment vs full-page dispatch.

## Key Interfaces

Read `docs/ARCHITECTURE.md` sections: Telemetry Engine, HTML-over-the-Wire Router.

## TDD Protocol

Write tests BEFORE implementation. Every feature follows red-green-refactor:

1. Write a failing test that specifies the behavior
2. Write the minimum code to make it pass
3. Refactor while keeping tests green

### Test Coverage Requirements

- Every function must have cyclomatic complexity < 20
- Test both Ok and Err branches of all Result-returning functions
- Buffer saturation (head overtakes tail) must be covered
- Edge cases: zero-length flush, max capacity wrap-around, concurrent delegation events
- Router: test fragment swap with/without persistent components, prefetch cache hit/miss, page cache TTL/eviction/persistence
- Server: test 404 fallback, 405 method rejection, safe error boundary

### LOC Targets

| Module | Estimated LOC | Test LOC |
|---|---|---|
| `telemetry/intent-types.ts` | ~50 | ~75 |
| `telemetry/object-pool.ts` | ~60 | ~200 |
| `telemetry/ring-buffer.ts` | ~110 | ~360 |
| `telemetry/event-delegation.ts` | ~60 | ~150 |
| `telemetry/flush.ts` | ~65 | ~215 |
| `router/push-state.ts` | ~100 | ~150 |
| `router/fragment-swap.ts` | ~80 | ~120 |
| `router/prefetch.ts` | ~70 | ~100 |

Tests should be ~1.5x the implementation LOC.

## Development Order

Build telemetry first (intent-types -> ring-buffer -> flush-worker), then router (push-state -> fragment-swap -> prefetch -> page-cache), then server (server-types -> server-router -> http-helpers). Each module is test-driven and merged only when all tests pass.
