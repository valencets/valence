<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="./assets/logo-dark-animated.png">
    <source media="(prefers-color-scheme: light)" srcset="./assets/logo-light-animated.png">
    <img alt="Valence" src="./assets/logo-light-animated.png" width="280">
  </picture>
</p>

<p align="center"><strong>Schema-driven web framework for Node.js and PostgreSQL.</strong></p>

<p align="center">
  <a href="https://www.npmjs.com/package/@valencets/valence"><img src="https://img.shields.io/npm/v/@valencets/valence" alt="npm"></a>
  <a href="https://socket.dev/npm/package/@valencets/valence"><img src="https://socket.dev/api/badge/npm/package/@valencets/valence" alt="Socket"></a>
  <a href="https://github.com/valencets/valence/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/valencets/valence/ci.yml?branch=master&label=CI" alt="CI"></a>
  <a href="https://github.com/valencets/valence/blob/master/LICENSE"><img src="https://img.shields.io/github/license/valencets/valence" alt="License"></a>
  <img src="https://img.shields.io/badge/TypeScript-strict-blue" alt="TypeScript">
  <img src="https://img.shields.io/badge/PostgreSQL-16+-4169E1?logo=postgresql&logoColor=white" alt="PostgreSQL">
</p>

---

Define collections and fields in one TypeScript config. Valence derives the database tables, admin UI, REST API, first-party analytics, validators, and migrations from that single schema. No plugins. No vendor scripts. No third-party browser JS.

```ts
// valence.config.ts
import { defineConfig, collection, field } from '@valencets/valence'

export default defineConfig({
  db: {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'mysite',
    username: process.env.DB_USER ?? 'postgres',
    password: process.env.DB_PASSWORD ?? ''
  },
  server: { port: Number(process.env.PORT ?? 3000) },
  collections: [
    collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', slugFrom: 'title', unique: true }),
        field.richtext({ name: 'body' }),
        field.relation({ name: 'category', relationTo: 'categories' }),
        field.boolean({ name: 'published' }),
        field.date({ name: 'publishedAt' })
      ]
    }),
    collection({
      slug: 'users',
      auth: true,
      fields: [
        field.text({ name: 'name', required: true }),
        field.select({ name: 'role', defaultValue: 'editor', options: [
          { label: 'Admin', value: 'admin' },
          { label: 'Editor', value: 'editor' }
        ]})
      ]
    })
  ],
  admin: { pathPrefix: '/admin', requireAuth: true },
  telemetry: {
    enabled: true,
    endpoint: '/api/telemetry',
    siteId: 'mysite'
  }
})
```

That config gives you: `posts` and `users` tables in Postgres, a server-rendered admin panel with form validation and session auth (Argon2id), a REST API at `/api/posts` and `/api/users`, Zod validators, database migrations, and a first-party analytics pipeline that tracks user intent with zero third-party scripts. Change the schema, everything follows.

## Quick Start

```bash
npx @valencets/valence init my-site
cd my-site
pnpm dev
```

The init wizard walks you through:

- **Database** -- name, user, password (creates the DB and runs migrations)
- **Admin user** -- email + password for the admin panel (role set to `admin`)
- **Seed data** -- optional sample content (category, post, page) to start with
- **Framework** -- plain HTML templates, Astro, or bring your own
- **Git** -- initializes a repo with the first commit

Pass `--yes` to skip prompts and accept defaults (useful for CI).

Open `http://localhost:3000/admin` to sign in. Open `http://localhost:3000` for the landing page.

## What You Get

- **Database tables** derived from your field definitions. UUID primary keys, timestamps, soft deletes.
- **Admin panel** at `/admin`. Server-rendered HTML forms, CSRF protection, session auth with Argon2id. Login page with proper error handling.
- **REST API** at `/api/:collection`. CRUD with Zod validation, parameterized queries, `Result<T, E>` error handling.
- **Migrations** generated from schema diffs. Deterministic SQL, idempotent, version-tracked.
- **Web Components**. 18 custom elements with ARIA, i18n, telemetry hooks, and hydration directives. Work in any framework or plain HTML.
- **First-party analytics**. Built-in telemetry that runs entirely in your Postgres -- no vendor scripts, no third-party dashboards, no data leaving your infrastructure.
- **Learn mode**. Interactive 6-step tutorial embedded in `valence dev` that teaches core concepts through real actions. Run `valence init --learn` to try it.

## Telemetry

Valence includes a complete, privacy-respecting analytics pipeline that runs entirely on your own infrastructure. No Google Analytics, no Plausible, no third-party scripts. Your data stays in your Postgres.

**How it works:**

1. Annotate HTML elements with `data-telemetry-*` attributes:
   ```html
   <button data-telemetry-type="CLICK" data-telemetry-target="hero.cta">
     Get Started
   </button>
   ```

2. The client library captures user intent events in a **pre-allocated ring buffer** (zero allocation in the hot path) and auto-flushes via `navigator.sendBeacon()` every 30 seconds.

3. The server ingests beacon payloads, stores raw events, and aggregates them into **daily summaries** -- sessions, pageviews, conversions, top pages, top referrers, device breakdowns.

4. View it all in the built-in **analytics dashboard** at `/admin/analytics`.

**11 intent types** beyond simple pageviews: `CLICK`, `SCROLL`, `VIEWPORT_INTERSECT`, `FORM_INPUT`, `INTENT_NAVIGATE`, `INTENT_CALL`, `INTENT_BOOK`, `INTENT_LEAD`, `LEAD_PHONE`, `LEAD_EMAIL`, `LEAD_FORM`. This means you can track conversion-oriented actions (calls, bookings, form submissions) natively, not just clicks.

**Architecture:** The telemetry pipeline spans two packages. `@valencets/core` handles client-side capture (ring buffer, event delegation, beacon flush). `@valencets/telemetry` handles server-side ingestion, validation, daily aggregation, and query functions (`getDailyTrend`, `getDailyBreakdowns`). The CMS admin panel consumes these queries to render the dashboard.

## Packages

| Package | What it does | Deps |
|---------|-------------|------|
| **@valencets/ui** | 18 Web Components. ARIA, i18n, telemetry hooks, hydration directives. OKLCH design tokens. | zero |
| **@valencets/core** | Router + server. `pushState` nav, fragment swaps, prefetch, view transitions, server islands. | zero |
| **@valencets/db** | PostgreSQL query layer. Tagged template SQL, parameterized queries, `Result<T,E>`, migration runner. | zero |
| **@valencets/cms** | Schema engine. `collection()` + `field.*` produces tables, validators, REST API, admin UI, auth, media. | core, db, ui |
| **@valencets/telemetry** | Beacon ingestion, event storage, daily summaries, fleet aggregation. | db |
| **@valencets/valence** | CLI. `valence init`, `valence dev`, `valence migrate`, `valence build`. | cms, db |

## Non-Negotiable

| Rule | Why |
|------|-----|
| Complexity < 20 | Every function fits on one screen. No exceptions. |
| `Result<T, E>` everywhere | If it can fail, the type signature says so. Both branches handled or it doesn't compile. |
| 14kB critical shell | First paint in the first TCP data flight. CDN-ready with cache profiles and server islands. |
| Pre-allocated ring buffer | Zero allocation in the telemetry hot path. |
| Zero third-party browser JS | Your site. Your code. Your data. Nothing phones home. |
| 1,337 tests | Strict TypeScript, neostandard, CI on every push. |

## Documentation

- [Getting Started](https://github.com/valencets/valence/wiki/Getting-Started)
- [Architecture](https://github.com/valencets/valence/wiki/Architecture)
- [CMS Guide](https://github.com/valencets/valence/wiki/CMS-Guide)
- [Developer Guide](https://github.com/valencets/valence/wiki/Developer-Guide)
- [Troubleshooting](https://github.com/valencets/valence/wiki/Troubleshooting)

## Contributing

```bash
git clone https://github.com/valencets/valence.git
cd valence
pnpm install
pnpm build
pnpm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for standards and the TDD workflow.

## License

MIT
