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

Define collections and fields in one TypeScript config. Valence derives the database tables, admin UI, REST API, validators, and migrations from that single schema. No plugins. No vendor scripts. No third-party browser JS.

```ts
// valence.config.ts
import { defineConfig, collection, field } from '@valencets/valence'

export default defineConfig({
  db: { host: 'localhost', port: 5432, database: 'mysite', username: 'postgres', password: '' },
  server: { port: 3000 },
  collections: [
    collection({
      slug: 'posts',
      labels: { singular: 'Post', plural: 'Posts' },
      fields: [
        field.text({ name: 'title', required: true }),
        field.slug({ name: 'slug', slugFrom: 'title' }),
        field.richtext({ name: 'body' }),
        field.relation({ name: 'category', relationTo: 'categories' }),
        field.boolean({ name: 'published' }),
        field.date({ name: 'publishedAt' })
      ]
    })
  ],
  admin: { pathPrefix: '/admin', requireAuth: true }
})
```

That config gives you a `posts` table in Postgres, a server-rendered admin panel with form validation, a REST API at `/api/posts`, Zod validators, and a migration file. Change the schema, everything follows.

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
- **Analytics dashboard** at `/admin/analytics`. Session counts, pageviews, top pages, top referrers. Your data in your Postgres, not a vendor dashboard.
- **REST API** at `/api/:collection`. CRUD with Zod validation, parameterized queries, `Result<T, E>` error handling.
- **Migrations** generated from schema diffs. Deterministic SQL, idempotent, version-tracked.
- **Web Components**. 18 custom elements with ARIA, i18n, telemetry hooks, and hydration directives. Work in any framework or plain HTML.
- **Telemetry**. Beacon ingestion, ring buffer capture, daily summaries. Zero third-party scripts.

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
