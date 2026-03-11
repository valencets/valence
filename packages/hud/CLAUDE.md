# packages/hud

Self-hosted analytics dashboard. Lives inside the CMS admin console. Replaces all third-party analytics.

## Read First

Full design spec, component architecture, layout wireframes, color system, and data contracts: `docs/HUD_SPEC.md`

## Core Rules

- All visualization is hand-built SVG and CSS. No charting libraries (no D3, no Recharts, no Chart.js).
- All data comes from pre-aggregated summary tables. Never query raw events.
- Fixed DOM structure. No infinite scroll. No dynamically appended chart nodes.
- Sparklines are single `<polyline>` elements mutated in-place on data update.
- All numeric displays use `font-variant-numeric: tabular-nums`.
- Fetchers return `ResultAsync`. On failure, hold last known good data. No error modals. No spinners.
- Color is functional per MIL-STD-1472G: green=positive, red=negative, amber=warning, accent=interactive.
- Two tiers: Client view (5 panels, no jargon) and Diagnostic view (studio operator only, gated).

## Component Naming

- File: `PascalCase.ts` (e.g., `HudMetric.ts`)
- Tag: `<hud-metric>`, `<hud-sparkline>`, `<hud-bar>`, `<hud-table>`, `<hud-status>`, `<hud-timerange>`, `<hud-panel>`
- Class: `PascalCase` (e.g., `class HudMetric extends HTMLElement`)

## Build Order

Tokens → Sparkline → Metric → Bar → Table → Status → TimeRange → Panel → ClientDashboard → DiagnosticDashboard → Data fetchers last.
