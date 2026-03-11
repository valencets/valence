# INERTIA HUD — Design & Build Specification

## What This Is

The HUD (Heads-Up Display) is Inertia's self-hosted, first-party analytics dashboard. It lives inside the client's headless CMS admin console as a single pane of glass: content editing and analytics in one interface. It replaces Google Analytics, Adobe Analytics, and every third-party tracking script. The client owns 100% of their data. Zero external dependencies means zero ad-blocker interference.

The HUD is not a generic dashboard. It is an aerospace-grade instrument panel built with the same deterministic constraints as the rest of Inertia. It reads from pre-aggregated PostgreSQL summary tables, never raw event rows. It renders with fixed-size DOM elements, never infinite scroll. It uses color as function, never decoration.

## Role & Context

You are building the HUD package (`packages/hud/`) for the Inertia framework. The target users are local service business owners in the DFW metro area: barbershops, contractors, legal practices, medical clinics, restaurants. These are not data analysts. They need to open the dashboard, understand what happened this week, and close it. The HUD must communicate complex telemetry in the simplest possible visual language without dumbing down the data.

Secondary users are the studio operator (Forrest) who needs deeper diagnostic views: ingestion pipeline health, buffer saturation, payload rejection rates.

## Design Philosophy: Industrial Minimalism Meets MIL-STD-1472G

The HUD's visual language is derived from three sources:

### 1. MIL-STD-1472G (Military Human Engineering Criteria)

- Color is functional, never decorative. Neutral tones form the atmospheric baseline. Bright saturated color is reserved strictly for status changes, alerts, or required actions.
- Contrast must be exceptional. Text against background must pass WCAG AAA (7:1 ratio minimum for body text).
- White space is the primary delimiter. No heavy borders, no box shadows, no card elevation patterns. Spatial grouping communicates hierarchy.
- The interface must be compatible with the cognitive processes of the operator. Prioritize immediate, unambiguous transfer of functional information over stylistic flourishes.

### 2. Tufte's Data-Ink Ratio

- Every rendered pixel must serve a communicative purpose.
- Maximize the data-ink ratio: the proportion of ink used to present actual data versus ink used for decoration.
- No chartjunk: no 3D effects, no gradient fills on bars, no decorative gridlines.
- Integrate graphical data tightly with text. Use inline sparklines and contextual numbers rather than separate chart pages.
- Sidenotes and annotations over tooltips and modals.

### 3. The Linear Aesthetic (Engineering-Grade Product Design)

- Near-monochrome foundation. Deep grays, not pure black. Off-whites, not pure white.
- One accent color for interactive states and critical data. Desaturated blue or warm amber, never both.
- One typeface family. Geometric sans-serif for labels and body. Monospace strictly for numerical data, tabular arrays, and raw values.
- Subtle transitions only (200-400ms linear easing). No spring physics, no bounce, no elastic animations. Data is a serious metric, not consumer entertainment.

## Color System

```
Foundation:
  --hud-bg:            hsl(220, 13%, 8%)      # Deep steel, not pure black
  --hud-surface:       hsl(220, 13%, 12%)     # Elevated panels
  --hud-border:        hsl(220, 10%, 18%)     # Subtle dividers (use sparingly)
  --hud-text-primary:  hsl(220, 10%, 88%)     # Primary text, high contrast
  --hud-text-secondary: hsl(220, 8%, 55%)     # Labels, captions, metadata
  --hud-text-muted:    hsl(220, 6%, 35%)      # Tertiary, timestamps

Functional (MIL-STD-1472G derived):
  --hud-positive:      hsl(145, 60%, 45%)     # Conversions, growth, healthy state
  --hud-negative:      hsl(0, 70%, 55%)       # Decline, errors, requires attention
  --hud-warning:       hsl(35, 85%, 55%)      # Threshold approaching, caution
  --hud-accent:        hsl(215, 60%, 55%)     # Interactive elements, links, focus rings
  --hud-neutral:       hsl(220, 8%, 45%)      # Baseline comparison, unchanged state

Rules:
  - Positive/negative/warning appear ONLY on data that has changed or requires attention
  - Accent appears ONLY on interactive elements (buttons, links, focus states)
  - Never use color alone to communicate meaning. Always pair with text, icon, or position.
  - No gradients anywhere in the HUD. Flat fills only.
```

## Typography

```
Primary:    system-ui, -apple-system, sans-serif  (or Inter if within 14kB budget)
Monospace:  ui-monospace, 'Cascadia Code', 'Fira Code', monospace

Usage:
  - All metric values rendered in monospace (numbers must not shift width as they change)
  - All labels, headings, body text in primary sans-serif
  - Tabular numbers enabled (font-variant-numeric: tabular-nums) on all numeric displays
  - Type scale: 12px / 14px / 16px / 20px / 28px. Five sizes. No more.
  - Line height: 1.4 for body, 1.2 for headings, 1.0 for metric values
```

## The Four Pillars Applied to the HUD

### AV Rule 206: Fixed DOM, No Dynamic Allocation

The HUD cannot append unlimited DOM nodes. All visualization containers are pre-allocated at boot with fixed dimensions.

- **No infinite scroll.** Log tables have a fixed row count (e.g., 25 rows). Pagination, not scroll.
- **No appending chart nodes.** All charts operate on fixed-size Canvas or SVG viewboxes. Data updates mutate existing path data in-place, never create new elements.
- **Sparklines** are the primary visualization primitive. A sparkline is a fixed-width, fixed-height inline SVG with a pre-allocated polyline. On data update, the points array shifts left and the new value is appended at the right edge. No DOM nodes created or destroyed.
- **Metric cards** display a single number, a sparkline, and a delta. The DOM structure is identical whether displaying 0 or 10,000,000. Only the text content and the polyline points attribute change.

### AV Rule 208: No Exceptions in the HUD

- All data fetching uses `ResultAsync` from `neverthrow`. The HUD never displays a broken state.
- If a fetch fails, the HUD holds the last known good data and shows a subtle timestamp indicator: "Last updated 3m ago" in `--hud-text-muted`. No error modals. No spinners. No red banners.
- If the aggregation cron hasn't run yet, the HUD displays "Awaiting first aggregation" in the relevant panel. Not an error state. An expected state.

### AV Rule 3: Micro-Components, Not Monoliths

Every HUD element is a single-responsibility Web Component with cyclomatic complexity < 20.

- `<hud-metric>` — One number, one label, one sparkline, one delta. That's it.
- `<hud-table>` — Fixed rows, fixed columns. Pagination controls. No sorting (sorting is a server concern, not a client concern).
- `<hud-sparkline>` — Pure SVG polyline renderer. Accepts a flat number array. Returns an SVG.
- `<hud-bar>` — Horizontal bar for proportional data. Fixed-width container. Bar width is a percentage.
- `<hud-status>` — System health indicator. Three states: nominal, degraded, offline. Color-coded per MIL-STD-1472G.
- `<hud-timerange>` — Date range selector. Discrete options only (Today, 7d, 30d, 90d). No custom date pickers.

### 14kB Budget

The HUD's critical shell (the chrome, navigation, and first visible panel) must fit in the initial TCP window. Charts load their data asynchronously after the shell paints. The user sees the structure instantly, then data populates panel by panel. No layout shift during population because all containers have pre-defined dimensions.

## Data Contracts

The HUD reads from two aggregation levels. Both are pre-computed by the background cron, never calculated at query time.

### Summary Tables (Hourly Rollups)

```typescript
interface SessionSummary {
  period_start: string; // ISO timestamp
  period_end: string;
  total_sessions: number;
  unique_referrers: number;
  device_breakdown: {
    mobile: number;
    desktop: number;
    tablet: number;
  };
}

interface EventSummary {
  period_start: string;
  period_end: string;
  event_category: string; // 'PAGEVIEW' | 'INTERACTION' | 'CONVERSION'
  total_count: number;
  unique_sessions: number;
}

interface ConversionSummary {
  period_start: string;
  period_end: string;
  intent_type: string; // 'INTENT_CALL' | 'INTENT_NAVIGATE' | 'INTENT_BOOK'
  total_count: number;
  top_sources: Array<{
    referrer: string;
    count: number;
  }>;
}
```

### Diagnostic Tables (Studio Operator Only)

```typescript
interface IngestionHealth {
  period_start: string;
  payloads_accepted: number;
  payloads_rejected: number; // Black Hole drops
  avg_processing_ms: number;
  buffer_saturation_pct: number;
}
```

## HUD Layout: Two Tiers

### Tier 1: Client View (The Business Owner)

This is what the barbershop owner sees. Five panels. No tabs. No navigation. Everything visible on one screen without scrolling on a 1280x720 viewport.

```
┌─────────────────────────────────────────────────────────┐
│  INERTIA HUD             [Today ▾] [7d] [30d] [90d]     │
├──────────────┬──────────────┬───────────────────────────┤
│              │              │                           │
│  VISITORS    │  LEADS       │  TOP PAGES                │
│  1,247       │  34          │  /                   412  │
│  ▁▂▃▄▅▆▇█▇▅  │  ▁▁▂▃▅▇█▆▄▂  │  /services           289  │
│  +12% vs 7d  │  +8% vs 7d   │  /contact            156  │
│              │              │  /about               98  │
│              │              │  /gallery             67  │
├──────────────┴──────────────┼───────────────────────────┤
│                             │                           │
│  LEAD ACTIONS               │  TRAFFIC SOURCES          │
│                             │                           │
│  ██████████ Phone  18       │  ████████████ Google  62% │
│  ██████     Map    11       │  ██████       Direct  24% │
│  ███        Book    5       │  ███          Yelp     9% │
│                             │  █            Other    5% │
│                             │                           │
└─────────────────────────────┴───────────────────────────┘
```

**Panel definitions:**

1. **VISITORS** — `<hud-metric>` showing total unique sessions for selected period. Sparkline shows daily distribution. Delta compares to previous equivalent period.

2. **LEADS** — `<hud-metric>` showing total high-intent conversion events (INTENT_CALL + INTENT_NAVIGATE + INTENT_BOOK). This is the number the business owner actually cares about. "34 people tried to reach you this week."

3. **TOP PAGES** — `<hud-table>` with 5 fixed rows. Page path and pageview count. Sorted server-side by count descending.

4. **LEAD ACTIONS** — `<hud-bar>` breakdown of conversion types. Phone calls, map clicks, booking widget opens. These are the Digital Handshake proxy metrics.

5. **TRAFFIC SOURCES** — `<hud-bar>` breakdown of session referrers, grouped into categories (Search, Direct, Social, Referral, Paid).

**Key design rules for Tier 1:**

- No jargon. "Visitors" not "Unique Sessions." "Leads" not "High-Intent Conversion Events."
- Every number is accompanied by a delta ("+12% vs 7d") so the owner knows if things are getting better or worse without needing to interpret a chart.
- Deltas use functional color: `--hud-positive` for growth, `--hud-negative` for decline, `--hud-neutral` for unchanged.
- The sparkline gives shape/trend at a glance without requiring the owner to read an axis.

### Tier 2: Diagnostic View (Studio Operator)

Accessed via a keybinding or hidden URL parameter. Not visible to clients.

```
┌─────────────────────────────────────────────────────────┐
│  INERTIA DIAGNOSTICS                        [1h refresh]│
├──────────────┬──────────────┬───────────────────────────┤
│  INGESTION   │  REJECTION   │  PIPELINE LATENCY         │
│  12,847/hr   │  0.3%        │  avg 2.1ms                │
│  ▇▇▇▇▇▇▇▇▇▇  │   ▁▁▁▁▁▁▁▁▁▁ │  p99 8.4ms                │
│  nominal     │  nominal     │  ▁▁▂▁▁▁▁▂▁▁               │
├──────────────┼──────────────┼───────────────────────────┤
│  BUFFER SAT  │  DB SIZE     │  AGGREGATION LAG          │
│  12%         │  142 MB      │  last run: 4m ago         │
│  ▁▁▁▂▁▁▁▁▂▁  │              │  duration: 1.2s           │
│  nominal     │  healthy     │  nominal                  │
└──────────────┴──────────────┴───────────────────────────┘
```

Each panel is a `<hud-metric>` with a `<hud-status>` indicator. Three states, three colors:

- **nominal** — `--hud-positive` (small dot, not a banner)
- **degraded** — `--hud-warning`
- **offline** — `--hud-negative`

## Offline Conversion Visualization

For service businesses without e-commerce, the HUD must make invisible conversions visible.

### Dynamic Number Insertion (DNI)

If DNI is active, the LEAD ACTIONS panel adds a sub-row: "Tracked Calls: 12 (via DNI)" showing how many phone calls were correlated back to web sessions. The number links to a detail view showing source breakdown per tracked number.

### Verified Promo Codes

If promo codes are active, a sixth panel appears below the fold:

```
  REDEEMED CODES
  SPRING25-A4F   Mar 8   Google → /services → code shown → redeemed
  SPRING25-B2C   Mar 6   Direct → /contact → code shown → redeemed
```

Each row traces the full attribution path from session source to physical redemption. This is the "closed loop" that proves web traffic drove a real-world transaction.

## Component Architecture

```
packages/hud/
  src/
    components/
      HudMetric.ts          # <hud-metric> — number + sparkline + delta
      HudSparkline.ts       # <hud-sparkline> — pure SVG polyline
      HudBar.ts             # <hud-bar> — horizontal proportional bar
      HudTable.ts           # <hud-table> — fixed-row data table
      HudStatus.ts          # <hud-status> — nominal/degraded/offline indicator
      HudTimeRange.ts       # <hud-timerange> — period selector
      HudPanel.ts           # <hud-panel> — layout container with label
    layouts/
      ClientDashboard.ts    # Tier 1 composition
      DiagnosticDashboard.ts # Tier 2 composition
    data/
      fetch-summaries.ts    # ResultAsync fetchers for summary tables
      format-delta.ts       # Pure function: compute delta + format string
      format-number.ts      # Pure function: 1247 → "1,247"
    tokens/
      hud-tokens.ts         # Color, type, spacing tokens as TS constants
    index.ts                # Barrel export
  CLAUDE.md
  package.json
```

## Implementation Rules

1. Every component extends `HTMLElement` and registers with `customElements.define()`.
2. No Shadow DOM on layout components (allows shared CSS tokens). Shadow DOM only on leaf components that need strict encapsulation.
3. All data flows one direction: fetch → format → render. Components never fetch their own data. Data is passed via attributes or properties from the layout.
4. Sparkline SVG is a single `<polyline>` element. Points are recalculated from the data array on every render. No animation between states. Instant swap. Data is truth.
5. All numeric displays use `font-variant-numeric: tabular-nums` so digits don't shift width as values change.
6. The `<hud-timerange>` component emits a custom event (`hud-period-change`) that the layout catches and uses to re-fetch all summary data for the new period.
7. Fetchers return `ResultAsync<SummaryData, FetchFailure>`. On `Err`, components hold last known good data and update the "Last updated" timestamp. No error modals. No spinners.
8. The diagnostic dashboard is gated by a URL parameter (`?diagnostics=1`) or a keyboard shortcut. It is never linked from the client-facing UI.

## What the HUD is NOT

- It is not a general-purpose BI tool. No custom queries, no pivot tables, no CSV exports (yet).
- It is not real-time. Data is aggregated hourly. The HUD reflects the last completed aggregation cycle.
- It is not configurable per-client (yet). Every client sees the same five panels. Customization comes later.
- It does not use any charting library (Recharts, Chart.js, D3). All visualization is hand-built with SVG and CSS.
- It does not use `localStorage`, `sessionStorage`, or any client-side persistence. State comes from the server on every load.

## Build Priority

1. `hud-tokens.ts` — Lock the visual language first.
2. `HudSparkline.ts` — The atomic visual primitive everything else depends on.
3. `HudMetric.ts` — Number + sparkline + delta. The workhorse component.
4. `HudBar.ts` — Proportional horizontal bars for breakdowns.
5. `HudTable.ts` — Fixed-row table for top pages.
6. `HudStatus.ts` — Three-state health indicator.
7. `HudTimeRange.ts` — Period selector emitting custom events.
8. `HudPanel.ts` — Layout container.
9. `ClientDashboard.ts` — Tier 1 composition.
10. `DiagnosticDashboard.ts` — Tier 2 composition.
11. `fetch-summaries.ts` — Wire data fetching last, after all components render with mock data.

## Success Criteria

The HUD succeeds when:

- A barbershop owner opens it, sees "34 leads this week, up 12%", and closes it in under 10 seconds.
- The studio operator opens diagnostics, sees six green "nominal" indicators, and closes it in under 5 seconds.
- The entire HUD shell renders in the first TCP window (14kB).
- No panel causes layout shift when data populates.
- The browser's memory profile remains flat regardless of how long the HUD is open.
- An engineer inspecting the network tab sees zero third-party requests.
