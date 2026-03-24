# Valence Architecture

Architectural reference for Valence. Read the section relevant to what you're working on.

## Table of Contents

1. [Engineering Philosophy](#engineering-philosophy)
2. [Package Dependency Graph](#package-dependency-graph)
3. [Error Handling Patterns](#error-handling-patterns)
4. [Telemetry Engine](#telemetry-engine)
5. [Ingestion Pipeline (Design Reference)](#ingestion-pipeline)
6. [HTML-over-the-Wire Router](#html-over-the-wire-router)
7. [View Transitions](#view-transitions)
8. [Server Islands](#server-islands)
9. [Hydration Directives](#hydration-directives)
10. [Server Utilities](#server-utilities)
11. [Database Layer](#database-layer)
12. [Telemetry Data Layer](#telemetry-data-layer)
13. [Design Tokens](#design-tokens)
14. [14kB Critical Path](#14kb-critical-path)

---

## Engineering Philosophy

Four rules. Break one, fix it before you merge.

**No allocation after init.**
GC pauses drop frames and stutter UI. Pre-allocate all structures at boot, mutate in-place, never create/destroy during runtime. The telemetry engine uses a ring buffer and object pool for exactly this reason.

**No exceptions.**
Exceptions create invisible control flow. Every fallible function returns `Result<Ok, Err>`. The compiler forces you to handle both branches. One `try/catch` exists in the entire codebase -- wrapping `JSON.parse`, because it throws by design.

**Complexity < 20.**
Every `if`, `for`, `while`, `&&`, `||` adds a decision path. Past 20, you can't exhaustively test it. Early returns, dictionary maps, small functions. No switch statements. No enums (const unions only).

**14kB first paint.**
TCP slow start gives you ~10 packets on the initial congestion window. At 1460 bytes per packet, that's ~14kB. The server flushes a complete, usable page in that first window. No external stylesheets in the critical path.

---

## Package Dependency Graph

Five packages under `packages/`, connected by workspace dependencies. `@valencets/resultkit` is an npm dependency (not vendored):

```
@valencets/core                (depends on @valencets/resultkit)
       |
       v
@valencets/db                  (depends on @valencets/resultkit, postgres, zod)
       |
       v
@valencets/telemetry           (depends on db, @valencets/resultkit, postgres)

@valencets/ui                  (zero deps)

@valencets/cms                 (v0.1 complete, depends on db, @valencets/resultkit, zod, argon2)
```

### Package Status

| Package | Status | Tests | Description |
|---|---|---|---|
| `packages/core/` | Built | 243 | Telemetry engine, HTML-over-the-wire router, view transitions, server islands, server utilities. |
| `packages/db/` | Built | 38 | PostgreSQL connection pool, config validation, migration runner, error mapping. |
| `packages/telemetry/` | Built | 59 | Summary table queries, daily summary aggregation, fleet data types. |
| `packages/ui/` | Built | 368 | ValElement protocol, 18 Web Component primitives, hydration directives, OKLCH tokens, Tailwind preset, theme contract. Zero deps. |
| `packages/cms/` | v0.1 complete | 270 tests | Schema engine, admin UI, auth, REST API, media, query builder |

### Module Boundaries

Each package owns its own types. Wiring happens at the application layer. `@valencets/db` never imports from `@valencets/core`. `@valencets/telemetry` depends on `@valencets/db` for `DbPool` and `mapPostgresError`, but never on `@valencets/core`.

---

## Error Handling Patterns

Every error type in the monorepo follows the same structural pattern: a const union for error codes, a corresponding type alias, and an interface that carries the code plus a human-readable message.

### Const Union + Interface Pattern

```typescript
export const DbErrorCode = {
  CONNECTION_FAILED: 'CONNECTION_FAILED',
  QUERY_FAILED: 'QUERY_FAILED',
  MIGRATION_FAILED: 'MIGRATION_FAILED',
  INVALID_CONFIG: 'INVALID_CONFIG',
  CONSTRAINT_VIOLATION: 'CONSTRAINT_VIOLATION',
  NO_ROWS: 'NO_ROWS'
} as const

export type DbErrorCode = typeof DbErrorCode[keyof typeof DbErrorCode]

export interface DbError {
  readonly code: DbErrorCode
  readonly message: string
}
```

No enums. Const unions compile to zero runtime code. Enums compile to objects.

This pattern repeats across packages:

- `packages/core/src/telemetry/intent-types.ts`: `TelemetryErrorCode` + `TelemetryError`
- `packages/core/src/router/router-types.ts`: `RouterErrorCode` + `RouterError`
- `packages/core/src/server/server-types.ts`: `ServerErrorCode` + `ServerError`
- `packages/db/src/types.ts`: `DbErrorCode` + `DbError`

### Result Monad Usage

All fallible functions return `Result<Ok, Err>` (synchronous) or `ResultAsync<Ok, Err>` (asynchronous) from `@valencets/resultkit`. The caller must explicitly handle both branches. No `.parse()` -- only `.safeParse()` for Zod schemas.

```typescript
// Synchronous: factory functions, validation, parsing
static create (capacity: number): Result<TelemetryRingBuffer, TelemetryError>

// Asynchronous: database queries, network I/O, file system
function closePool (pool: DbPool): ResultAsync<void, DbError>
```

Chaining uses `.map()`, `.andThen()`, and `.match()`. Never `.unwrap()` or `.expect()`.

### JSON.parse Boundary

`safeJsonParse` is the single `try/catch` in the codebase. `JSON.parse` throws by design and there is no safer alternative:

```typescript
function safeJsonParse(raw: string): Result<unknown, ParseFailure> {
  try {
    return ok(JSON.parse(raw))
  } catch {
    return err({ code: 'PARSE_FAILURE', raw })
  }
}
```

Everything downstream of this boundary is pure monadic flow.

---

## Telemetry Engine

Location: `packages/core/src/telemetry/`

### GlobalTelemetryIntent (Monomorphic Interface)

Every property defined upfront. Identical shape, identical init order. This preserves V8 Inline Cache monomorphism (single hidden class = O(1) property access).

```typescript
const IntentType = {
  CLICK: 'CLICK',
  SCROLL: 'SCROLL',
  VIEWPORT_INTERSECT: 'VIEWPORT_INTERSECT',
  FORM_INPUT: 'FORM_INPUT',
  INTENT_NAVIGATE: 'INTENT_NAVIGATE',
  INTENT_CALL: 'INTENT_CALL',
  INTENT_BOOK: 'INTENT_BOOK',
  INTENT_LEAD: 'INTENT_LEAD',
  LEAD_PHONE: 'LEAD_PHONE',
  LEAD_EMAIL: 'LEAD_EMAIL',
  LEAD_FORM: 'LEAD_FORM'
} as const

const BusinessType = [
  'barbershop', 'legal', 'hvac', 'medical',
  'restaurant', 'contractor', 'retail', 'other'
] as const

interface GlobalTelemetryIntent {
  id: string
  timestamp: number
  type: IntentType
  targetDOMNode: string
  x_coord: number
  y_coord: number
  isDirty: boolean
  schema_version: number
  site_id: string
  business_type: BusinessType
  path: string
  referrer: string
}
```

### TelemetryObjectPool

Location: `packages/core/src/telemetry/object-pool.ts`

Pre-allocates `N` `GlobalTelemetryIntent` objects at boot via `createEmptyIntent()`. Capacity must be a power of two (validated at creation via `Result`). Provides `getSlot(index)` for direct access and `resetSlot(index)` to zero out a slot's fields without destroying the object. `resetAll()` zeros every slot in a single pass.

No objects are created or destroyed after initialization. The pool is the memory budget, and the buffer operates within it. Pre-allocation eliminates GC pressure during runtime when every millisecond of frame time matters.

### TelemetryRingBuffer

Location: `packages/core/src/telemetry/ring-buffer.ts`

Fixed capacity backed by a `TelemetryObjectPool`. Uses bitmask pointer arithmetic for O(1) advancement: `head = (head + 1) & mask` where `mask = capacity - 1`.

**Write path**: Check if buffer is full (count equals capacity). If full, advance `tail` to overwrite the oldest un-flushed entry. Access the slot at `head` index via the object pool, mutate its properties in-place, set `isDirty = true`, advance `head`. Telemetry is non-critical; recency is prioritized over completeness.

**Flush path**: `collectDirty()` iterates from `tail` to `head`, collecting slots where `isDirty === true`. After dispatch, `markFlushed(count)` resets slots via the pool and advances `tail`. Objects are never destroyed.

**Saturation**: When `head` catches `tail`, the oldest entry is silently overwritten. No exception, no error -- the buffer self-heals by dropping stale data.

### Event Delegation

Location: `packages/core/src/telemetry/event-delegation.ts`

Single click listener on a root element (defaults to `document.body`). HTML elements declare tracking intent via `data-*` attributes:

```html
<a href="tel:555-1234"
   data-telemetry-type="INTENT_CALL"
   data-telemetry-target="header-phone">
  Call Us
</a>
```

The delegation handler reads `data-telemetry-type` and `data-telemetry-target` on event bubbling, resolves the type through a static dictionary map (`intentTypeMap`), and writes to the next buffer slot. Lead actions (`tel:`, `mailto:` links) are detected automatically by href prefix without requiring `data-*` attributes.

Components never execute tracking directly. The engine owns all telemetry writes.

### Flush Mechanics

Location: `packages/core/src/telemetry/flush.ts`

`flushTelemetry()` collects dirty entries from the buffer, serializes via `JSON.stringify`, and dispatches via `navigator.sendBeacon()`. Returns `Result<number, TelemetryError>` -- `Ok` with the count flushed, or `Err` if the buffer was empty or `sendBeacon` rejected.

`scheduleAutoFlush()` sets up an interval timer and a `visibilitychange` listener (flushes when the tab is hidden). Returns a `FlushHandle` with `stop()` and `flushNow()` methods.

### Schema Versioning

Every intent includes `schema_version: 1`. The ingestion pipeline routes events through a version-discriminated handler dictionary:

```typescript
const handlers: Record<number, IntentHandler> = {
  1: handleV1Intent,
}
```

Old events in the immutable ledger remain valid forever. No migration. No rewrite.

---

## Ingestion Pipeline

Status: Design reference. The original `packages/ingestion/` has been removed. This pipeline will be rebuilt as part of `packages/cms/` or a dedicated package. The patterns documented here remain the architectural target.

### Monadic Pipeline

1. Receive raw request body as string
2. `safeJsonParse(raw)` -- `Result<unknown, ParseFailure>` (the one permitted try/catch)
3. Zod `.safeParse()` against version-discriminated schema -- `Result<T, ValidationFailure>`
4. Chain via @valencets/resultkit `.map()` / `.andThen()`
5. Final `.match()`:
   - `Ok`: append to PostgreSQL immutable ledger
   - `Err`: log to internal audit stream, return HTTP 200 OK

### Silent Accept on Bad Data

Why return 200 on bad data? HTTP 4xx/5xx responses trigger automated retry mechanisms in browsers and service workers. Thousands of concurrent clients retrying simultaneously equals a self-inflicted DDoS. Return 200 OK. Client clears its buffer. Bad data goes to an internal audit log for developer review. The server stays up.

### HMAC Verification

For signed payloads (daily summary pushes from remote appliances): extract `X-Valence-Signature` header, verify HMAC-SHA256 with `crypto.timingSafeEqual`. Timing-safe comparison prevents timing attacks. Invalid signatures still return 200 OK -- never reveal authentication failures to the caller.

---

## HTML-over-the-Wire Router

Location: `packages/core/src/router/`

### Anticipatory Prefetching

Location: `packages/core/src/router/prefetch.ts`

Bind a `mousemove` listener on `document.body`. Track cursor movement and calculate velocity between successive captures via Euclidean distance over time delta. If velocity drops below a configurable threshold (`velocityThreshold`, default 0.3) while hovering over an anchor element, start an intent timer (`intentDurationMs`, default 80ms). When the timer fires, dispatch a background `fetch()` for the target URL.

Prefetched responses are stored in a capacity-bounded `Map` (default 32 entries, configurable via `prefetchCacheCapacity`). TTL-based expiry (`prefetchTtlMs`, default 30s). Eviction removes the oldest entry when the cache is full.

When the fragment protocol is enabled (default), prefetch requests include the `X-Valence-Fragment: 1` header to receive a partial response.

### Push-State Navigation

Location: `packages/core/src/router/push-state.ts`

1. Intercept click on `<a>` element via delegation on `document.body`
2. `shouldIntercept()` filters: skip modifier keys, `_blank` targets, `data-valence-ignore`, `download` attributes, hash-only hrefs, cross-origin links
3. Check page cache (session-storage backed, stale-while-revalidate) -- serve instantly, revalidate in background
4. Check prefetch cache -- serve if hit, promote to page cache
5. Network fetch as final fallback
6. Parse fetched HTML via `DOMParser.parseFromString(html, 'text/html')` -- creates inert document, scripts neutralized
7. Extract content fragment via `querySelector(contentSelector)` (default `'main'`)
8. Dispatch `valence:before-swap` event
9. Swap via `replaceChildren()` or `moveBefore()` for persistent elements
10. Dispatch `valence:after-swap` event
11. `window.history.pushState(stateObj, '', targetUrl)` -- URL updates without reload

### Fragment Protocol Versioning

```
Request header:   X-Valence-Fragment: 1
Response header:  X-Valence-Fragment: 1
```

Version increments when the fragment format changes. Router and server negotiate compatibility. Version mismatch detection clears the prefetch cache to prevent stale content.

### Lifecycle Events

The router dispatches custom events during navigation:

- `valence:before-navigate` -- cancelable, fired before any fetch. Returning false cancels navigation.
- `valence:before-swap` -- fired after HTML is parsed, before DOM mutation. Tear down page-scoped state.
- `valence:after-swap` -- fired after DOM mutation completes. Rebuild page-scoped state for the new route.
- `valence:navigated` -- fired after push-state, carries `NavigationPerformance` detail (source, duration, from/to URLs).

### Persistent Elements

When `Element.moveBefore()` is available, the router preserves elements marked with `data-valence-persist` and a stable `id`. Instead of destroying and recreating them during a swap, it uses `moveBefore()` to atomically relocate them into the new fragment. This retains encapsulated JavaScript state (media players, multi-step forms, telemetry observers) across navigations.

### popstate Handling

Listen for `window.onpopstate` (back/forward buttons). Same three-tier resolution: page cache, prefetch cache, network fetch. Same fragment swap logic.

### Page Cache

Location: `packages/core/src/router/page-cache.ts`

LRU cache backed by `sessionStorage` (when available, falls back to in-memory). Configurable capacity (`pageCacheCapacity`, default 16) and TTL (`pageCacheTtlMs`, default 5 minutes). Paths matching `noCachePaths` (default `['/admin']`) are never cached. Implements stale-while-revalidate: serves the cached version immediately, then fetches fresh content in the background and re-swaps if the response differs.

---

## View Transitions

Location: `packages/core/src/router/view-transitions.ts`

Wraps the browser's View Transitions API around the router's fragment swap. When `document.startViewTransition` is available, DOM mutations happen inside the transition callback. When it's not, the swap runs directly -- no polyfill, no fallback animation, just the swap.

**How it works:**

1. `applyTransitionNames(container)` scans for `[transition:name]` attributes and sets `style.viewTransitionName` on each matching element
2. `wrapInTransition(doSwap, liveContainer)` applies transition names to the live DOM, calls `document.startViewTransition()` with the swap function inside, then re-applies names to the new content after swap
3. `clearTransitionNames(container)` removes all `viewTransitionName` styles after the transition finishes (or fails)

**Markup:**

```html
<header transition:name="site-header">...</header>
<main transition:name="page-content">...</main>
```

`transition:name` sets the `view-transition-name` CSS property for matched element pairing across navigations. `transition:persist` is an alias for `data-valence-persist` -- same persistent element behavior, friendlier attribute name.

---

## Server Islands

Location: `packages/core/src/router/server-islands.ts`

Deferred server-rendered fragments. The page shell ships immediately with placeholder elements. After initial render, placeholders marked with `[server:defer]` and a `src` attribute fetch their content from server endpoints and swap it in.

**How it works:**

1. `initServerIslands(config?)` scans the document for `[server:defer][src]` elements
2. Each island fetches its `src` URL with an `X-Valence-Fragment: 1` header
3. On success, the placeholder's `innerHTML` is replaced with the response HTML
4. On failure, a `valence:island-error` custom event bubbles up with status/error details
5. On success, a `valence:island-loaded` custom event bubbles up
6. The `valence:after-swap` event triggers a re-scan, so islands inside router-swapped content are picked up automatically

**Markup:**

```html
<div server:defer src="/api/weather-widget">
  <p>Loading weather...</p>
</div>
```

A `WeakSet` tracks loaded islands to prevent duplicate fetches. The returned `IslandHandle` provides `destroy()` (aborts in-flight requests, removes the event listener) and `scanAndLoad()` for manual re-scans.

On the server side, `sendIslandHtml(res, html, options?)` sends island content with the `X-Valence-Fragment: 1` header and optional `Cache-Control` for CDN caching.

---

## Hydration Directives

Location: `packages/ui/src/core/val-element.ts`

`ValElement` supports four declarative hydration directives that control when a Web Component actually initializes. Until the directive fires, the element sits in the DOM as inert HTML -- no shadow DOM, no template clone, no JS execution.

**Directives:**

- `hydrate:load` -- hydrate immediately on `connectedCallback` (default behavior, same as no directive)
- `hydrate:idle` -- defer until `requestIdleCallback` fires (browser is idle)
- `hydrate:visible` -- defer until `IntersectionObserver` reports the element is in the viewport
- `hydrate:media="(query)"` -- defer until a `matchMedia` query matches (e.g., `hydrate:media="(min-width: 768px)"`)

**How it works:**

The `connectedCallback` gate checks for a hydration directive on first call. If a non-`load` directive is found, state moves to `'pending'` and the appropriate scheduler is set up. When the condition fires, `connectedCallback` re-runs and the element initializes normally -- template clone, shadow DOM, locale observer subscription.

`disconnectedCallback` cleans up any pending hydration scheduler (cancels idle callback, disconnects intersection observer, removes media query listener).

**Markup:**

```html
<val-accordion hydrate:idle>...</val-accordion>
<val-carousel hydrate:visible>...</val-carousel>
<val-sidebar hydrate:media="(min-width: 1024px)">...</val-sidebar>
```

This keeps the initial JS execution budget tight. Below-the-fold components and non-critical UI stay inert until they're actually needed.

---

## Server Utilities

Location: `packages/core/src/server/`

### Server Router

Location: `packages/core/src/server/server-router.ts`

Minimal route dispatcher built on `node:http`. `createServerRouter<TCtx>()` returns a `ServerRouter` with `register(path, entry)` and `handle(req, res, ctx)`. Routes are registered as `RouteEntry` objects with optional `GET` and `POST` handlers.

The dispatcher parses the URL, looks up the route in a `Map`, and dispatches to the method-specific handler. Unmatched routes fall through to a registered `/404` handler or return a default 404 response. Method mismatches return 405.

All handler execution is wrapped in `ResultAsync.fromPromise` via `safeDispatch`. If a handler throws (despite the project-wide no-exceptions rule), the error is caught and logged, and a generic 500 response is sent if headers have not already been written. This is the server-side safety net, analogous to `safeJsonParse` on the ingestion side.

### HTTP Helpers

Location: `packages/core/src/server/http-helpers.ts`

Pure utility functions with no state:

- `sendHtml(res, html, statusCode?, extraHeaders?)` -- sets Content-Type, Content-Length, writes response
- `sendJson(res, data, statusCode?)` -- serializes to JSON, sets headers, writes response
- `sendError(res, error)` -- renders a minimal HTML error page from a `ServerError`
- `isFragmentRequest(req)` -- checks for `X-Valence-Fragment: 1` header
- `readBody(req, maxBytes?)` -- collects request body chunks into a string (Promise-based, rejects if body exceeds `MAX_BODY_BYTES` default 1 MiB)
- `sendIslandHtml(res, html, options?)` -- sends island fragment HTML with `X-Valence-Fragment: 1` header and optional `Cache-Control` max-age for CDN caching

### Server Types

```typescript
type RouteHandler<TCtx> = (req: IncomingMessage, res: ServerResponse, ctx: TCtx) => Promise<void>

interface RouteEntry<TCtx> {
  readonly GET?: RouteHandler<TCtx>
  readonly POST?: RouteHandler<TCtx>
}

interface ServerRouter<TCtx> {
  readonly register: (path: string, entry: RouteEntry<TCtx>) => void
  readonly handle: (req: IncomingMessage, res: ServerResponse, ctx: TCtx) => Promise<void>
}
```

The `TCtx` generic allows application-level context (database pool, config, auth state) to be threaded through every handler without global state.

---

## Database Layer

Location: `packages/db/`

### Connection Pool

Location: `packages/db/src/connection.ts`

`validateDbConfig(config)` validates an unknown input against a Zod schema and returns `Result<DbConfig, DbError>`. `createPool(config)` instantiates a `postgres` connection pool wrapped in a `DbPool` interface. `closePool(pool)` gracefully shuts down the pool, returning `ResultAsync<void, DbError>`.

The `DbPool` interface exposes a single `readonly sql: Sql` property. All query functions accept a `DbPool` argument rather than a raw connection, ensuring the pool is the single point of database access.

```typescript
interface DbPool {
  readonly sql: Sql
}

interface DbConfig {
  readonly host: string
  readonly port: number
  readonly database: string
  readonly username: string
  readonly password: string
  readonly max: number
  readonly idle_timeout: number
  readonly connect_timeout: number
}
```

### Error Mapping

Location: `packages/db/src/connection.ts`

`mapPostgresError(e)` converts unknown thrown values from the `postgres` driver into typed `DbError` objects. PostgreSQL error codes are mapped through a static `PG_ERROR_MAP`:

- `23503`, `23505`, `23514` (foreign key, unique, check constraint) map to `CONSTRAINT_VIOLATION`
- `42501` (insufficient privilege) maps to `QUERY_FAILED`
- All other errors map to `QUERY_FAILED` with the original message preserved

This function is re-exported and used by `@valencets/telemetry` for its own query functions.

### Migration Runner

Location: `packages/db/src/migration-runner.ts`

Forward-only migration system. Migration files follow the naming convention `NNN-name.sql` (e.g., `001-init.sql`).

Pipeline:

1. `loadMigrations(directory)` -- reads a directory, parses filenames via `parseMigrationFilename`, reads SQL content, sorts by version number, validates for duplicate versions. Returns `ResultAsync<ReadonlyArray<MigrationFile>, DbError>`.
2. `runMigrations(pool, migrations)` -- creates a `_migrations` tracking table if it does not exist, queries for already-applied versions, runs each unapplied migration in a transaction (`BEGIN` + `INSERT INTO _migrations`). Returns `ResultAsync<number, DbError>` with the count of newly applied migrations.
3. `getMigrationStatus(pool)` -- returns the list of applied versions and their timestamps.

```typescript
interface MigrationFile {
  readonly version: number
  readonly name: string
  readonly sql: string
}
```

Each migration runs in its own transaction. If a migration fails, the transaction rolls back and the error propagates as a `DbError` with code `MIGRATION_FAILED`.

### Driver

`postgres` (porsager/postgres). Native ESM, tagged template SQL (parameterized by default), zero external dependencies, TypeScript-first. Imported as `import postgres from 'postgres'` -- default import because it is a third-party API, not subject to the project's named-exports-only convention.

---

## Telemetry Data Layer

Location: `packages/telemetry/`

This package sits above `@valencets/db` and provides the query and aggregation logic for telemetry summary tables. It imports `DbPool` and `mapPostgresError` from `@valencets/db` but never imports from `@valencets/core`.

### Summary Types

Location: `packages/telemetry/src/summary-types.ts`

Row types for the periodic summary tables:

- `SessionSummaryRow` -- total sessions, unique referrers, device breakdown (mobile/desktop/tablet) for a time period
- `EventSummaryRow` -- event category, total count, unique sessions for a time period
- `ConversionSummaryRow` -- intent type, total count, top sources (referrer + count) for a time period
- `IngestionHealthRow` -- payloads accepted/rejected, average processing time, buffer saturation percentage
- `SummaryPeriod` -- start/end date pair used to scope all summary queries

### Summary Aggregation

Location: `packages/telemetry/src/aggregation.ts`

Three aggregation functions that run INSERT...ON CONFLICT DO UPDATE queries against the summary tables:

- `aggregateSessionSummary(pool, period)` -- counts sessions, unique referrers, device types within the period
- `aggregateEventSummary(pool, period)` -- groups events by category with unique session counts
- `aggregateConversionSummary(pool, period)` -- groups high-intent events (INTENT_CALL, INTENT_BOOK, LEAD_PHONE, LEAD_EMAIL, LEAD_FORM) with top referrer sources

All return `ResultAsync` wrapping the upserted row(s).

### Summary Queries

Location: `packages/telemetry/src/summary-queries.ts`

Read functions for the summary tables: `getSessionSummaries`, `getEventSummaries`, `getConversionSummaries`, `getIngestionHealth`. All accept a `DbPool` and `SummaryPeriod`, return `ResultAsync<ReadonlyArray<Row>, DbError>`.

`insertIngestionHealth` writes a health metrics record and returns the inserted row.

### Daily Summary Types

Location: `packages/telemetry/src/daily-summary-types.ts`

One denormalized row per site per day, designed for fleet aggregation:

```typescript
interface DailySummaryRow {
  readonly id: number
  readonly site_id: string
  readonly date: Date
  readonly business_type: string
  readonly schema_version: number
  readonly session_count: number | null
  readonly pageview_count: number | null
  readonly conversion_count: number | null
  readonly top_referrers: ReadonlyArray<TopReferrerEntry> | null
  readonly top_pages: ReadonlyArray<TopPageEntry> | null
  readonly intent_counts: Readonly<Record<string, number>> | null
  readonly avg_flush_ms: number | null
  readonly rejection_count: number | null
  readonly synced_at: Date | null
  readonly created_at: Date
}
```

Supporting types: `InsertableDailySummary` (for local generation), `DailySummaryPayload` (for remote insertion with string date), `DailyBreakdowns` (merged top pages, referrers, and intent counts across a date range), `TopReferrerEntry`, `TopPageEntry`.

### Daily Summary Aggregation

Location: `packages/telemetry/src/daily-summary-aggregation.ts`

`generateDailySummary(pool, siteId, businessType, date)` queries session summaries, event summaries, conversion summaries, top referrers, top pages, intent counts, and ingestion health for a single day, then upserts a denormalized `DailySummaryRow`. All sub-queries run in parallel via `Promise.all`. Returns `ResultAsync<DailySummaryRow, DbError>`.

### Daily Summary Queries

Location: `packages/telemetry/src/daily-summary-queries.ts`

- `getDailySummary(pool, siteId, date)` -- fetch a single day's summary
- `getUnsyncedDailySummaries(pool, siteId)` -- fetch all rows where `synced_at IS NULL`, ordered by date ascending (for push to fleet)
- `markSynced(pool, id)` -- update `synced_at` to `NOW()` after successful push
- `insertDailySummaryFromRemote(pool, summary)` -- upsert a `DailySummaryPayload` received from a remote appliance
- `getDailyTrend(pool, siteId, start, end)` -- fetch session/pageview/conversion counts across a date range for sparkline rendering
- `getDailyBreakdowns(pool, siteId, start, end)` -- merge top pages, top referrers, and intent counts across multiple days

---

## Design Tokens

Location: `packages/ui/src/tokens/`

### OKLCH Color Space

All 51 primitive color values use the OKLCH color space (`oklch(L C H)`). OKLCH is perceptually uniform: the same lightness value produces the same perceived brightness across all hues (unlike HSL where yellow at L=50% is visually brighter than blue at L=50%).

Five color scales (gray, blue, red, green, amber), each with 10-11 stops. Shadow colors use `oklch(0 0 0 / alpha)`. Semantic tokens reference primitives via `var()` — no hardcoded colors in component CSS.

Benefits:
- Consistent contrast ratios across hues for accessibility
- Mathematically invertible lightness for dark mode palettes
- Native P3 wide-gamut support without redesign
- 95%+ browser support

### Token Architecture

Two CSS files, loaded in order:

1. **`primitives.css`** — raw values: 51 OKLCH colors, 13 spacing steps, 9 type sizes, 4 radii, 3 shadows, 3 durations, 3 easings
2. **`semantic.css`** — contextual aliases: `--val-color-primary` → `var(--val-blue-600)`. Components use only semantic tokens. Dark mode via `prefers-color-scheme` media query.

### Theme Contract

Location: `packages/ui/src/tokens/theme-contract.ts`

Formalizes which tokens a valid theme must define:

- `THEME_TOKENS_REQUIRED` — 15 semantic tokens (surfaces, text, interactive, feedback, border, focus)
- `THEME_TOKENS_DARK` — 6 tokens that must be overridden in dark mode (strict subset of required)
- `validateTheme()` — reads computed styles from `:root`, returns missing token names. Empty array = valid theme.

Third-party themes are CSS files that override semantic token values. Load after `semantic.css`. Components don't change. The Tailwind preset picks up new values automatically.

```typescript
import { validateTheme } from '@valencets/ui'
const missing = validateTheme()
if (missing.length > 0) console.warn('Theme missing tokens:', missing)
```

### Tailwind Preset

Location: `packages/ui/src/tailwind/preset.ts`

Optional preset mapping all `--val-*` tokens to Tailwind theme utilities. Components use Shadow DOM (Tailwind can't penetrate), so component internals stay as CSS custom properties. The preset serves the layout layer around components.

```typescript
// tailwind.config.ts
import { valencePreset } from '@valencets/ui/tailwind'
export default { presets: [valencePreset], content: ['./src/**/*.{html,ts}'] }
```

Maps 102 tokens across: colors (14 semantic + 5 primitive scales), spacing (13 steps), border-radius (4), font-size (9), font-family (2), box-shadow (3), transition-duration (3), transition-timing-function (3).

Tailwind is an optional peer dependency. The preset is a plain object with zero runtime imports.

---

## 14kB Critical Path

TCP slow start: 10 packets x 1460 bytes = approximately 14kB. The server must flush a usable page in that first window.

### Strategy

1. Inline critical CSS in `<style>` tag in `<head>` (no external stylesheet requests)
2. Compress with Brotli/Gzip (14kB compressed is roughly 50kB uncompressed)
3. `<link rel="preload">` for fonts and critical assets
4. `<link rel="dns-prefetch">` for external domains
5. Fixed `width`/`height` on all above-fold images
6. Defer all non-critical JS (Web Components are fully deferred)
7. Per-page JS dependency injection (server determines what each page needs)
8. System font stack only. Zero web font downloads.

### The Math

14kB includes HTTP headers (uncompressed even with HTTP/2 on first response) and images. Budget the headers, budget the CSS, budget the initial DOM. Everything else loads after the first ACK.

HTTP/3 and QUIC still recommend the same 14kB initial window. This rule holds.
