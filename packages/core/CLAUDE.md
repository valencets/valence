# packages/core

Telemetry engine and HTML-over-the-wire router. The two most critical subsystems in Inertia.

## Telemetry Rules

- All `GlobalTelemetryIntent` objects are pre-allocated at boot. Never use `new` at runtime.
- The `TelemetryRingBuffer` has fixed capacity. Modulo arithmetic for pointer advancement.
- Flush via `navigator.sendBeacon`. Reset `isDirty` flags, never destroy objects.
- Single event listener on `document.body` using event delegation. Read `data-*` attributes.
- Consider Web Worker for serialization offloading.

## Router Rules

- Intercept `<a>` clicks, prevent default, use `history.pushState()`.
- Parse fetched HTML with `DOMParser.parseFromString()` (scripts are neutralized).
- Extract `<main>` fragment via `querySelector`, swap via `replaceChildren()`.
- Prefetch on hover intent (velocity + trajectory calculation).
- Use `Element.moveBefore()` for persistent Web Components to preserve lifecycle state.

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
- Router: test fragment swap with/without persistent components, prefetch cache hit/miss

### LOC Targets

| Module | Estimated LOC | Test LOC |
|---|---|---|
| `telemetry/ring-buffer.ts` | ~120 | ~200 |
| `telemetry/object-pool.ts` | ~80 | ~120 |
| `telemetry/event-delegation.ts` | ~60 | ~100 |
| `telemetry/flush.ts` | ~50 | ~80 |
| `router/navigator.ts` | ~100 | ~150 |
| `router/fragment-swap.ts` | ~80 | ~120 |
| `router/prefetch.ts` | ~70 | ~100 |

Tests should be ~1.5x the implementation LOC.

## Development Order

Build telemetry first (ring buffer → object pool → event delegation → flush), then router (navigator → fragment swap → prefetch). Each module is test-driven and merged only when all tests pass.
