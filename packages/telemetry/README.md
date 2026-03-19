# @valencets/telemetry

[![npm](https://img.shields.io/npm/v/@valencets/telemetry)](https://www.npmjs.com/package/@valencets/telemetry)
[![License](https://img.shields.io/github/license/valencets/valence)](https://github.com/valencets/valence/blob/master/LICENSE)

Server-side telemetry engine for the [Valence](https://github.com/valencets/valence) web framework. Ingests beacon payloads from the client, stores raw events in PostgreSQL, aggregates daily summaries, and exposes query functions for the CMS analytics dashboard.

96 tests. [Full documentation on the wiki.](https://github.com/valencets/valence/wiki/Packages:-Telemetry)

## What It Does

Valence telemetry is a complete first-party analytics pipeline. No third-party scripts, no vendor dashboards. Your data stays in your Postgres.

### Beacon Ingestion

The ingestion handler receives batched events from `navigator.sendBeacon()` on the client. It validates payloads (JSON structure, intent types, site ID), rejects malformed data silently (always returns 200 to avoid client retries), and batch-inserts valid events.

### Daily Aggregation

Raw events are rolled up into daily summaries:

- **Sessions** -- unique session counts by device type (mobile/desktop/tablet)
- **Pageviews** -- page view counts per day
- **Conversions** -- conversion counts by intent type (calls, bookings, leads)
- **Top pages** -- most visited pages
- **Top referrers** -- traffic sources
- **Intent breakdown** -- counts by all 11 intent types
- **Health metrics** -- rejection counts, flush timing

### Query Functions

```typescript
import { getDailyTrend, getDailyBreakdowns } from '@valencets/telemetry'

// Date-ordered array of daily summaries
const trend = await getDailyTrend(pool, siteId, startDate, endDate)

// Merged aggregations: top 10 pages, top 10 referrers, intent counts
const breakdowns = await getDailyBreakdowns(pool, siteId, startDate, endDate)
```

### 11 Intent Types

Goes beyond pageviews to track user intent:

| Type | Category |
|------|----------|
| `CLICK`, `SCROLL`, `VIEWPORT_INTERSECT`, `FORM_INPUT` | Interaction |
| `INTENT_NAVIGATE` | Navigation |
| `INTENT_CALL`, `INTENT_BOOK`, `INTENT_LEAD` | Conversion |
| `LEAD_PHONE`, `LEAD_EMAIL`, `LEAD_FORM` | Lead capture |

### Client-Side Pairing

The client half lives in `@valencets/core`. HTML elements are annotated with `data-telemetry-type` and `data-telemetry-target` attributes. Events are captured via event delegation into a pre-allocated ring buffer (zero allocation in the hot path) and auto-flushed every 30 seconds.

## Quick Start

```bash
pnpm install
pnpm build
pnpm --filter=@valencets/telemetry test
```

## License

MIT
