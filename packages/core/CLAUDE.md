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

## Testing

Every function must have cyclomatic complexity < 20. Test both Ok and Err branches of all Result-returning functions. Buffer saturation (head overtakes tail) must be covered.
