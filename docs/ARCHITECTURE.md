# Inertia Architecture

Complete architectural reference for the Inertia deterministic web framework. Read the relevant section when working on that subsystem.

## Table of Contents

1. [Engineering Philosophy](#engineering-philosophy)
2. [Telemetry Engine](#telemetry-engine)
3. [Ingestion Node](#ingestion-node)
4. [HTML-over-the-Wire Router](#html-over-the-wire-router)
5. [Web Component Primitives](#web-component-primitives)
6. [PostgreSQL Schema](#postgresql-schema)
7. [Offline Conversion Tracking](#offline-conversion-tracking)
8. [Analytics Viewer (HUD)](#analytics-viewer)
9. [14kB Critical Path](#14kb-critical-path)

---

## Engineering Philosophy

Inertia applies JSF (Joint Strike Fighter) AV C++ Coding Standards to web development. The core metaphor is "remove before flight": strip dangerous language features to achieve deterministic, predictable behavior.

**AV Rule 206 — No Dynamic Memory Allocation After Init**
In C++, dynamic heap allocation causes fragmentation and unpredictable execution times. In JavaScript, it causes garbage collection "stop-the-world" pauses that drop frames and stutter UI. Solution: pre-allocate all structures at boot, mutate in-place, never create/destroy during runtime.

**AV Rule 208 — No Exceptions**
The Ariane 5 rocket exploded because a 64-bit float converted to a 16-bit int threw an unhandled exception. Exceptions create unpredictable control flow. Solution: every function returns a `Result<Ok, Err>` type. The compiler forces explicit handling of both branches.

**AV Rule 3 — Cyclomatic Complexity < 20**
Formula: `V(G) = E - N + 2P` where E=edges, N=nodes, P=connected components. Every `if`, `for`, `while`, `&&`, `||` adds a decision path. Above 20, exhaustive testing becomes mathematically impossible. Solution: early returns, dictionary maps, micro-componentization.

---

## Telemetry Engine

Location: `packages/core/src/telemetry/`

### GlobalTelemetryIntent (Monomorphic Interface)

Every property defined upfront. Identical shape, identical init order. This preserves V8 Inline Cache monomorphism (single hidden class = O(1) property access).

```typescript
enum IntentType {
  CLICK = 'CLICK',
  SCROLL = 'SCROLL',
  VIEWPORT_INTERSECT = 'VIEWPORT_INTERSECT',
  FORM_INPUT = 'FORM_INPUT',
  INTENT_NAVIGATE = 'INTENT_NAVIGATE',
  INTENT_CALL = 'INTENT_CALL',
  INTENT_BOOK = 'INTENT_BOOK'
}

interface GlobalTelemetryIntent {
  id: string
  timestamp: number
  type: IntentType
  targetDOMNode: string
  x_coord: number
  y_coord: number
  isDirty: boolean
}
```

If objects have varying shapes at runtime, V8 degrades from monomorphic → polymorphic → megamorphic, falling back to slow dictionary lookups. Never append undocumented fields.

### TelemetryRingBuffer

Fixed capacity `N` (default 1024) allocated at boot as `Array<GlobalTelemetryIntent>`. Each slot initialized with zeroed placeholder data and `isDirty: false`.

**Write path**: Access slot at `head` index → mutate properties in-place → set `isDirty = true` → advance: `head = (head + 1) % capacity`

**Saturation**: When `head === tail`, buffer is full. Oldest un-flushed events are overwritten. Telemetry is non-critical; recency is prioritized.

**Flush path**: Iterate `tail` to `head`, collect slots where `isDirty === true` → serialize → dispatch via `navigator.sendBeacon` or `fetch` → reset `isDirty = false`, zero strings → advance `tail`. Never destroy objects.

**Performance**: Consider offloading serialization (`JSON.stringify`) and `sendBeacon` to a dedicated Web Worker to keep main thread clean.

### Event Delegation Pattern

Single listener on `document.body`. HTML elements carry tracking metadata via `data-*` attributes:

```html
<a href="tel:555-1234"
   data-telemetry-type="INTENT_CALL"
   data-telemetry-target="header-phone">
  Call Us
</a>
```

The engine reads `data-*` attrs on event bubbling, formats the intent, writes to the next buffer slot. Components never execute tracking directly.

---

## Ingestion Node

Location: `packages/ingestion/`

### Monadic Pipeline

1. Receive raw request body as string
2. `safeJsonParse(raw)` → `Result<unknown, ParseFailure>`
   - This is the ONE permitted `try/catch` in the entire codebase
   - Wraps native `JSON.parse` SyntaxError into a typed Result
3. Zod `.safeParse()` against `GlobalTelemetryIntent` schema → `Result<T, ValidationFailure>`
4. Chain via `neverthrow` `.map()` / `.andThen()`
5. Final `.match()`:
   - `Ok`: append to PostgreSQL immutable ledger
   - `Err`: log to internal audit stream → return HTTP 200 OK

### The Black Hole Strategy

Why return 200 on bad data? Because HTTP 4xx/5xx responses trigger automated retry mechanisms in browsers and service workers. If a framework update ships a malformed telemetry schema to thousands of client sites simultaneously, error responses would cause every client to retry infinitely = self-inflicted DDoS.

Returning 200 OK tricks the client into clearing its buffer and advancing the read pointer. The bad data is silently logged for developer auditing. The server remains indestructible.

### safeJsonParse Boundary

```typescript
// THE boundary. The only try/catch in the codebase.
function safeJsonParse(raw: string): Result<unknown, ParseFailure> {
  try {
    return ok(JSON.parse(raw))
  } catch {
    return err({ code: 'PARSE_FAILURE', raw })
  }
}
```

---

## HTML-over-the-Wire Router

Location: `packages/core/src/router/`

### Anticipatory Prefetching

Bind listeners to all outbound `<a>` elements. Track cursor movement:

- Capture mouse coordinates at intervals
- Calculate Euclidean distance between successive captures
- If velocity drops below threshold for minimum duration → user is aiming at link
- Dispatch background `fetch()` for target URL
- Cache response in Service Worker

When click fires: intercept default navigation → retrieve cached HTML → swap fragment. Target: sub-10ms perceived transitions.

### Push-State Navigation

1. Intercept click on `<a>` element
2. `window.history.pushState(stateObj, '', targetUrl)` — URL updates without reload
3. Parse fetched HTML via `DOMParser.parseFromString(html, 'text/html')` — creates inert document, scripts neutralized
4. `newDoc.querySelector('main')` — extract content fragment
5. `document.querySelector('main').replaceChildren(fragment)` — single synchronous swap

### popstate Handling

Listen for `window.onpopstate` (back/forward buttons). Retrieve cached HTML or fetch if cache miss. Same fragment swap logic.

### McMaster-Carr Lessons Applied

- Server-rendered HTML, not client-side SPA
- Aggressive CDN + Service Worker caching
- Critical CSS inlined in `<style>` before `<body>`
- Per-page JS dependency injection (only load what the page needs)
- Fixed `width`/`height` on all images (zero layout shift)
- Image sprites where applicable
- `<link rel="preload">` for fonts and critical assets
- `<link rel="dns-prefetch">` for external domains

---

## Web Component Primitives

Location: `packages/components/`

### Lifecycle Preservation

Standard problem: `replaceChildren()` destroys components. `disconnectedCallback()` fires, state lost.

Solution: `Element.moveBefore()` + `connectedMoveCallback()`. When the router identifies persistent elements (media player, multi-step form, telemetry observer), it uses `moveBefore()` instead of `appendChild()`. This atomic operation retains encapsulated JS state, memory references, and avoids teardown.

### Scoped Custom Element Registries

When injecting components from separate HTML payloads, pass a localized `CustomElementRegistry` to `attachShadow()`. Prevents global namespace collisions.

### Component Pattern

```typescript
class TrackingButton extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', this.handleInteraction)
  }

  disconnectedCallback() {
    this.removeEventListener('click', this.handleInteraction)
  }

  connectedMoveCallback() {
    // Preserve state across router transitions
  }

  private handleInteraction = () => {
    // Dispatch to TelemetryRingBuffer via event delegation
    // Component does NOT execute tracking directly
  }
}

customElements.define('tracking-button', TrackingButton)
```

---

## PostgreSQL Schema

Location: `packages/db/`

### Core Tables

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE sessions (
  session_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  referrer         TEXT,
  device_type      VARCHAR(50) NOT NULL,
  operating_system VARCHAR(50)
);

CREATE TABLE events (
  event_id         BIGSERIAL PRIMARY KEY,
  session_id       UUID NOT NULL REFERENCES sessions(session_id) ON DELETE RESTRICT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_category   VARCHAR(100) NOT NULL,
  dom_target       TEXT,
  payload          JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_time_category ON events(created_at, event_category);
CREATE INDEX idx_events_payload ON events USING GIN (payload jsonb_path_ops);
```

### The 1/80th Rule

If a JSONB key appears in >1/80th of total rows, extract it to a first-class typed column. Prevents TOAST bloat (PostgreSQL forces oversized rows into out-of-line storage at ~2kB) and preserves query planner statistics.

Run a nightly cron: `jsonb_object_keys()` aggregation to detect threshold crossings.

### GIN Index Choice

`jsonb_path_ops` over default GIN: smaller index, faster containment (`@>`) and JSON path (`@?`) queries. Sacrifices key-exists operators (`?`, `?|`) which are not needed for dashboard aggregation patterns.

### Immutability Enforcement

Application service account: `INSERT` + `SELECT` only. `UPDATE`, `DELETE`, `TRUNCATE` revoked at engine level. Corrections are appended as compensating events, never mutations. Session liveness is derived from the last event timestamp — a pure read against existing data, not a stored `is_active` column.

### Aggregation

Background cron crunches raw events → summary tables hourly. Dashboard reads summaries, never raw events. Sub-second load times.

---

## Offline Conversion Tracking

For service businesses without e-commerce checkout:

### Click-to-Action Logging
Intercept `tel:`, `mailto:`, and outbound map clicks. Log `GlobalTelemetryIntent` (type: `INTENT_CALL`, `INTENT_NAVIGATE`, `INTENT_BOOK`) before external navigation fires.

### Dynamic Number Insertion (DNI)
Swap displayed phone numbers based on session origin (organic vs. paid). The number maps to session UUID. When the call reaches the physical location, offline correlation without cookies.

### Verified Digital Promo Codes
Generate unique, time-boxed codes tied to `session_id` (e.g., `SPRING25-XYZ`). Customer provides code at POS → synced back to PostgreSQL → deterministic conversion attribution.

---

## Analytics Viewer

Location: `packages/hud/`

Lives inside the Headless CMS admin console. Single pane of glass: content editing + analytics. Built with Inertia's own Web Component primitives and pure functional charting. Reads from aggregated summary tables. Zero external dependencies means no ad-blocker interference.

---

## 14kB Critical Path

TCP slow start: 10 packets × 1460 bytes = ~14kB. The server must flush a usable page in that first window.

### Strategy

1. Inline critical CSS in `<style>` tag in `<head>` (no external stylesheet requests)
2. Compress with Brotli/Gzip (14kB compressed ≈ 50kB uncompressed)
3. `<link rel="preload">` for fonts and critical assets
4. `<link rel="dns-prefetch">` for external domains
5. Fixed `width`/`height` on all above-fold images
6. Defer all non-critical JS
7. Per-page JS dependency injection (server determines what each page needs)

### The Math

14kB includes HTTP headers (uncompressed even with HTTP/2 on first response) and images. Budget the headers, budget the CSS, budget the initial DOM. Everything else loads after the first ACK.

HTTP/3 and QUIC still recommend the same 14kB initial window. This rule holds.
