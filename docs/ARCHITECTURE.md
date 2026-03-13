# Inertia Architecture

Complete architectural reference for the Inertia deterministic web framework. Read the relevant section when working on that subsystem.

## Table of Contents

1. [Engineering Philosophy](#engineering-philosophy)
2. [Infrastructure Model](#infrastructure-model)
3. [Telemetry Engine](#telemetry-engine)
4. [Ingestion Node](#ingestion-node)
5. [HTML-over-the-Wire Router](#html-over-the-wire-router)
6. [Web Component Primitives](#web-component-primitives)
7. [PostgreSQL Schema](#postgresql-schema)
8. [Multi-Tenant Aggregation](#multi-tenant-aggregation)
9. [Offline Conversion Tracking](#offline-conversion-tracking)
10. [Analytics Viewer (HUD) & Fleet Dashboard](#analytics-viewer)
11. [Content Management (Payload CMS)](#content-management)
12. [14kB Critical Path](#14kb-critical-path)

---

## Engineering Philosophy

Inertia applies JSF (Joint Strike Fighter) AV C++ Coding Standards to web development. The core metaphor is "remove before flight": strip dangerous language features to achieve deterministic, predictable behavior.

**AV Rule 206 — No Dynamic Memory Allocation After Init**
In C++, dynamic heap allocation causes fragmentation and unpredictable execution times. In JavaScript, it causes garbage collection "stop-the-world" pauses that drop frames and stutter UI. Solution: pre-allocate all structures at boot, mutate in-place, never create/destroy during runtime.

**AV Rule 208 — No Exceptions**
The Ariane 5 rocket exploded because a 64-bit float converted to a 16-bit int threw an unhandled exception. Exceptions create unpredictable control flow. Solution: every function returns a `Result<Ok, Err>` type. The compiler forces explicit handling of both branches.

**AV Rule 3 — Cyclomatic Complexity < 20**
Formula: `V(G) = E - N + 2P` where E=edges, N=nodes, P=connected components. Every `if`, `for`, `while`, `&&`, `||` adds a decision path. Above 20, exhaustive testing becomes mathematically impossible. Solution: early returns, dictionary maps, micro-componentization. No switch statements. No enums (const unions only).

---

## Infrastructure Model

### Hardware Appliance

Each client deployment runs on a dedicated fanless x86 mini-PC:

```
CPU:       Intel N100 quad-core @ 3.4GHz (x86-64, fanless)
RAM:       8GB+ DDR4/DDR5
Storage:   WD Red SN700 500GB NVMe (NAS-grade, high TBW for PostgreSQL WAL)
Power:     12V barrel + inline DC mini-UPS (survives power blips)
Network:   Dual NIC preferred (LAN + WireGuard tunnel)
Noise:     Zero (fanless passive cooling)
Cost:      ~$350-400 all-in per unit
```

Why not Raspberry Pi: SD cards corrupt under PostgreSQL write-ahead log pressure. ARM Docker ecosystem has quirks. The N100 is x86-64, runs stock Debian, and every package works without ARM compatibility concerns.

Why not ZimaBoard: Cost/margin ratio doesn't work for the pricing model. The N100 fanless boxes from AliExpress (Topton/CWWK) deliver more performance for less money.

### Network Routing (Disposable Infrastructure)

The appliance never exposes ports to the public internet. Instead:

```
[Client's browser]
       ↓ HTTPS
[Stateless VPS: $4/mo Hetzner/DigitalOcean]
  - Caddy reverse proxy (SSL termination, Brotli, HTTP/2)
  - Public IP + client's domain DNS
       ↓ WireGuard tunnel (encrypted, outbound-initiated by appliance)
[Client's appliance: behind their router, no port forwarding]
  - Node.js serving Inertia site
  - PostgreSQL with all data
  - Payload CMS admin
```

The VPS is stateless and disposable. It holds no data, no application logic, no database. If it dies, spin a new one, point DNS, restore the WireGuard peer config. 60 seconds to recovery. The site's authoritative data lives on the appliance, never on the VPS.

Why not Cloudflare Tunnels: Surrenders traffic routing control to a Big Tech intermediary. Violates the ownership thesis. The client should own their network path, not rent it from Cloudflare's infrastructure.

### Gliding Failover

The appliance maintains a static HTML snapshot of the entire site on the VPS:

```
1. Client edits content in Payload CMS → publishes
2. Payload webhook triggers static export on the appliance
3. Appliance compiles full static HTML snapshot of every page
4. rsync pushes the snapshot to the VPS via the WireGuard tunnel
5. Caddy on the VPS is configured with two upstreams:
   - Primary: reverse proxy to appliance (via tunnel)
   - Fallback: serve static HTML from /var/www/fallback/
```

If the appliance goes offline (power outage, ISP down, hardware failure):
- Caddy health check fails on the tunnel upstream
- Caddy automatically serves the static snapshot
- Visitors see the last-published version of the site
- Dynamic telemetry pauses (ring buffer can't flush, ingestion endpoint is unreachable)
- The public storefront never goes dark

When the appliance reconnects:
- WireGuard tunnel re-establishes automatically
- Caddy health check passes, live serving resumes
- Telemetry resumes from where the ring buffer left off

This means a local business website on Inertia has higher uptime than most cloud-hosted WordPress sites, because the fallback is pre-compiled HTML served from a CDN-adjacent VPS.

---

## Telemetry Engine

Location: `packages/core/src/telemetry/`

### GlobalTelemetryIntent (Monomorphic Interface)

Every property defined upfront. Identical shape, identical init order. This preserves V8 Inline Cache monomorphism (single hidden class = O(1) property access).

```typescript
const IntentType = [
  'CLICK', 'SCROLL', 'VIEWPORT_INTERSECT', 'FORM_INPUT',
  'INTENT_NAVIGATE', 'INTENT_CALL', 'INTENT_BOOK'
] as const
type IntentType = typeof IntentType[number]

const BusinessType = [
  'barbershop', 'legal', 'hvac', 'medical',
  'restaurant', 'contractor', 'retail', 'other'
] as const
type BusinessType = typeof BusinessType[number]

interface GlobalTelemetryIntent {
  id: string
  timestamp: number
  type: IntentType
  targetDOMNode: string
  x_coord: number
  y_coord: number
  isDirty: boolean
  schema_version: number    // Always 1 at launch. Incremented on breaking changes.
  site_id: string           // Opaque identifier, not the domain name
  business_type: BusinessType
}
```

No enums. Const unions compile to zero runtime code. Enums compile to objects.

### TelemetryRingBuffer

Fixed capacity `N` (default 1024) allocated at boot as `Array<GlobalTelemetryIntent>`. Each slot initialized with zeroed placeholder data and `isDirty: false`.

**Write path**: Access slot at `head` index → mutate properties in-place → set `isDirty = true` → advance: `head = (head + 1) & mask` (bitmask for power-of-2 capacity)

**Saturation**: When `head === tail`, buffer is full. Oldest un-flushed events are overwritten. Telemetry is non-critical; recency is prioritized.

**Flush path**: Iterate `tail` to `head`, collect slots where `isDirty === true` → serialize → dispatch via `navigator.sendBeacon` or `fetch` → reset `isDirty = false`, zero strings → advance `tail`. Never destroy objects.

**Performance**: Serialization (`JSON.stringify`) and `sendBeacon` offloaded to a dedicated Web Worker to keep the main thread clean.

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

### Schema Versioning

Every intent includes `schema_version: 1`. The ingestion pipeline routes events through a version-discriminated handler dictionary:

```typescript
const handlers: Record<number, IntentHandler> = {
  1: handleV1Intent,
}
```

v1 payloads (no site_id) remain valid for backward compatibility. v2 payloads require site_id and business_type. Old events in the immutable ledger remain valid forever. No migration. No rewrite.

---

## Ingestion Node

Location: `packages/ingestion/`

### Monadic Pipeline

1. Receive raw request body as string
2. `safeJsonParse(raw)` → `Result<unknown, ParseFailure>` (the ONE permitted try/catch)
3. Zod `.safeParse()` against version-discriminated schema → `Result<T, ValidationFailure>`
4. Chain via `neverthrow` `.map()` / `.andThen()`
5. Final `.match()`:
   - `Ok`: append to PostgreSQL immutable ledger
   - `Err`: log to internal audit stream → return HTTP 200 OK

### The Black Hole Strategy

Why return 200 on bad data? HTTP 4xx/5xx responses trigger automated retry mechanisms in browsers and service workers. Thousands of concurrent clients retrying simultaneously = self-inflicted DDoS. Return 200 OK. Client clears its buffer. Bad data is silently logged for developer auditing. Server stays indestructible.

### safeJsonParse Boundary

```typescript
function safeJsonParse(raw: string): Result<unknown, ParseFailure> {
  try {
    return ok(JSON.parse(raw))
  } catch {
    return err({ code: 'PARSE_FAILURE', raw })
  }
}
```

The boundary. The only try/catch in the codebase.

### Aggregation Endpoint

Location: `packages/ingestion/` (receives daily summaries from client appliances)

Pipeline: extract `X-Inertia-Signature` header → verify HMAC-SHA256 with `crypto.timingSafeEqual` → safeJsonParse → Zod .safeParse() against DailySummary schema → persist or Black Hole.

HMAC prevents unauthorized pushes. Timing-safe comparison prevents timing attacks. Black Hole pattern applies: invalid signature returns 200 OK, never reveals auth failures.

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

### Fragment Protocol Versioning

```
Request header:   X-Inertia-Fragment: 1
Response header:  X-Inertia-Fragment: 1
```

Version increments when the fragment format changes. Router and server negotiate compatibility.

### beforeSwap / afterSwap Lifecycle Hooks

The router emits lifecycle events during fragment swaps:

```typescript
router.on('beforeSwap', () => {
  // Tear down any page-scoped state (e.g., backtick overlay, animations)
})

router.on('afterSwap', () => {
  // Rebuild page-scoped state for new route context
})
```

This is critical for the Glass Box backtick overlay: the overlay controller must tear down before the swap and rebuild after, because `disconnectedCallback()` does not reliably fire when nodes are moved rather than destroyed during fragment replacement.

### popstate Handling

Listen for `window.onpopstate` (back/forward buttons). Retrieve cached HTML or fetch if cache miss. Same fragment swap logic.

---

## Web Component Primitives

Location: `packages/components/`

### Lifecycle Preservation

Standard problem: `replaceChildren()` destroys components. `disconnectedCallback()` fires, state lost.

Solution: `Element.moveBefore()` + `connectedMoveCallback()`. When the router identifies persistent elements (media player, multi-step form, telemetry observer), it uses `moveBefore()` instead of `appendChild()`. This atomic operation retains encapsulated JS state.

### Scoped Custom Element Registries

When injecting components from separate HTML payloads, pass a localized `CustomElementRegistry` to `attachShadow()`. Prevents global namespace collisions.

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

CREATE TABLE daily_summaries (
  id               BIGSERIAL PRIMARY KEY,
  site_id          TEXT NOT NULL,
  date             DATE NOT NULL,
  business_type    TEXT NOT NULL,
  schema_version   INTEGER NOT NULL DEFAULT 1,
  session_count    INTEGER NOT NULL DEFAULT 0,
  pageview_count   INTEGER NOT NULL DEFAULT 0,
  conversion_count INTEGER NOT NULL DEFAULT 0,
  top_referrers    JSONB NOT NULL DEFAULT '[]'::jsonb,
  top_pages        JSONB NOT NULL DEFAULT '[]'::jsonb,
  intent_counts    JSONB NOT NULL DEFAULT '{}'::jsonb,
  avg_flush_ms     NUMERIC,
  rejection_count  INTEGER NOT NULL DEFAULT 0,
  synced_at        TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(site_id, date)
);

CREATE INDEX idx_events_session ON events(session_id);
CREATE INDEX idx_events_time_category ON events(created_at, event_category);
CREATE INDEX idx_events_payload ON events USING GIN (payload jsonb_path_ops);
CREATE INDEX idx_summaries_site_date ON daily_summaries(site_id, date);
```

### The 1/80th Rule

If a JSONB key appears in >1/80th of total rows, extract it to a first-class typed column. Prevents TOAST bloat and preserves query planner statistics. Nightly cron runs `jsonb_object_keys()` aggregation to detect threshold crossings.

### Immutability Enforcement

Application service account: `INSERT` + `SELECT` only. `UPDATE`, `DELETE`, `TRUNCATE` revoked at engine level. Exception: `daily_summaries.synced_at` column is updateable (narrow column-specific GRANT for marking push completion).

---

## Multi-Tenant Aggregation

### Two-Layer Architecture

```
CLIENT APPLIANCE (their hardware, their building):
  Visitor → tracking component → ring buffer → sendBeacon
    → /api/telemetry → ingestion pipeline → events table
    → hourly cron → summary tables → client HUD

  Daily cron → generateDailySummary → daily_summaries table
    → pushDailySummary (HMAC-SHA256 signed)
    → POST to studio's /api/aggregation via WireGuard → VPS → studio
    → mark synced_at on local row

STUDIO APPLIANCE (your hardware, your office):
  /api/aggregation → verify HMAC → safeJsonParse → Zod .safeParse()
    → persist to studio daily_summaries table
    → or Black Hole (200 OK, log, drop)

  /admin/fleet → FleetDashboard
    → reads studio daily_summaries
    → one row per client, health indicators (green/yellow/red)
    → filterable by business_type

  /admin/fleet/compare → FleetComparison
    → cross-client analytics by business_type
```

### Privacy Contract

What leaves the client appliance (daily, anonymized, HMAC-signed): site_id (opaque), business_type, date, session/pageview/conversion counts, top 10 referrers, top 10 pages, intent type counts, system health metrics.

What NEVER leaves: individual session IDs, IP addresses (never collected), timestamps of individual events, raw event payloads, form data, any PII.

---

## Offline Conversion Tracking

For service businesses without e-commerce checkout:

### Click-to-Action Logging
Intercept `tel:`, `mailto:`, and outbound map clicks. Log `GlobalTelemetryIntent` before external navigation fires.

### Dynamic Number Insertion (DNI)
Swap displayed phone numbers based on session origin. Correlate dialed number to session UUID without cookies.

### Verified Digital Promo Codes
Unique, time-boxed codes tied to `session_id`. Redeemed at POS, synced back to PostgreSQL.

---

## Analytics Viewer

Location: `packages/hud/`

### Client HUD (`/admin/hud`)
Visible on every appliance. Shows that client's own analytics: sessions, pageviews, conversions, referrers, high-intent actions. Built with Inertia's own Web Components. Pure SVG/CSS charting — no charting libraries.

### Fleet Dashboard (`/admin/fleet`)
Visible only on the studio appliance. Shows all client sites in one view. Each row: site_id, business_type, metrics, health indicator (green = reported today, yellow = 24-48h stale, red = offline 48h+). Filterable by business_type.

### Fleet Comparison (`/admin/fleet/compare`)
Cross-client analytics grouped by business_type. Conversion patterns, traffic trends, top performers. 30-day sparkline trends.

---

## Content Management

### Payload CMS 3.x

Self-hosted headless CMS running on the same Node.js process and PostgreSQL instance as the Inertia site. MIT license. No external SaaS dependency.

- Admin UI at `/admin` (React-based, but this is the back-office panel, never public-facing)
- Content stored in the client's own PostgreSQL database on their own hardware
- API delivers structured JSON consumed by Inertia's server-side route handlers
- On publish: webhook triggers static snapshot export for gliding failover

The React in Payload's admin panel does NOT violate the framework's "no React" rule. That rule applies to public-facing pages served to visitors. The admin panel is an authenticated back-office tool behind `/admin`.

---

## 14kB Critical Path

TCP slow start: 10 packets × 1460 bytes = ~14kB. The server must flush a usable page in that first window.

### Strategy

1. Inline critical CSS in `<style>` tag in `<head>` (no external stylesheet requests)
2. Compress with Brotli/Gzip (14kB compressed ≈ 50kB uncompressed)
3. `<link rel="preload">` for fonts and critical assets
4. `<link rel="dns-prefetch">` for external domains
5. Fixed `width`/`height` on all above-fold images
6. Defer all non-critical JS (Glass Box components are fully deferred)
7. Per-page JS dependency injection (server determines what each page needs)
8. System font stack only. Zero web font downloads.

### The Math

14kB includes HTTP headers (uncompressed even with HTTP/2 on first response) and images. Budget the headers, budget the CSS, budget the initial DOM. Everything else loads after the first ACK.

HTTP/3 and QUIC still recommend the same 14kB initial window. This rule holds.
